import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { ensureCompatibleFormat, speechToText } from "./replit_integrations/audio";
import { AccessToken } from "livekit-server-sdk";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Set up Replit Auth
  await setupAuth(app);

  // Body parser with 50MB limit for audio payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: false, limit: "50mb" }));

  // Middleware to ensure user is authenticated
  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // --- Personas ---
  app.get(api.personas.list.path, requireAuth, async (req, res) => {
    const personas = await storage.listPersonas((req.user as any).id);
    res.json(personas);
  });

  app.post(api.personas.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.personas.create.input.parse(req.body);
      const persona = await storage.createPersona({
        ...input,
        userId: (req.user as any).id,
      });
      res.status(201).json(persona);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get(api.personas.get.path, requireAuth, async (req, res) => {
    const persona = await storage.getPersona(Number(req.params.id));
    if (!persona || persona.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Persona not found" });
    }
    res.json(persona);
  });

  app.delete(api.personas.delete.path, requireAuth, async (req, res) => {
    const persona = await storage.getPersona(Number(req.params.id));
    if (!persona || persona.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Persona not found" });
    }
    await storage.deletePersona(Number(req.params.id));
    res.status(204).send();
  });

  // --- Conversations ---
  app.get(api.conversations.list.path, requireAuth, async (req, res) => {
    const conversations = await storage.listConversations((req.user as any).id);
    res.json(conversations);
  });

  app.post(api.conversations.create.path, requireAuth, async (req, res) => {
    const { personaId } = req.body;
    const persona = await storage.getPersona(personaId);
    if (!persona || persona.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Persona not found" });
    }

    const conversation = await storage.createConversation(
      (req.user as any).id,
      personaId,
      `Chat with ${persona.name}`
    );
    res.status(201).json(conversation);
  });

  app.get(api.conversations.get.path, requireAuth, async (req, res) => {
    const conversation = await storage.getConversation(Number(req.params.id));
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const messages = await storage.getMessages(conversation.id);
    res.json({ ...conversation, messages });
  });

  // --- Messages & AI ---
  app.post(api.conversations.messages.create.path, requireAuth, async (req, res) => {
    const conversationId = Number(req.params.id);
    const { content, audio, voice = "alloy" } = req.body;
    const conversation = await storage.getConversation(conversationId);
    
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const persona = await storage.getPersona(conversation.personaId);
    if (!persona) {
      return res.status(404).json({ message: "Persona not found" });
    }

    let userContent = content;

    // Handle audio input if provided
    if (audio) {
      const rawBuffer = Buffer.from(audio, "base64");
      const { buffer: audioBuffer, format: inputFormat } = await ensureCompatibleFormat(rawBuffer);
      userContent = await speechToText(audioBuffer, inputFormat);
    }

    if (!userContent) {
      return res.status(400).json({ message: "Content or audio is required" });
    }

    // Save user message
    await storage.createMessage(conversationId, "user", userContent);

    // Get history
    const history = await storage.getMessages(conversationId);
    
    // Construct system prompt
    const systemPrompt = `You are playing the role of ${persona.name}. 
    Your description: ${persona.description}. 
    Your goal is to have a natural conversation with a Christian who is witnessing to you.
    React according to your persona's beliefs and background. 
    Do not break character. 
    If they make a good point, you can acknowledge it, but stay true to your skepticism or beliefs.`;

    // Handle SSE if it's a voice/audio request or if streaming is preferred
    if (audio || req.headers.accept === "text/event-stream") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      if (audio) {
        res.write(`data: ${JSON.stringify({ type: "user_transcript", data: userContent })}\n\n`);
      }

      const stream = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
        ],
        stream: true,
      });

      let assistantTranscript = "";

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;

        if (delta?.audio?.transcript) {
          assistantTranscript += delta.audio.transcript;
          res.write(`data: ${JSON.stringify({ type: "transcript", data: delta.audio.transcript })}\n\n`);
        }

        if (delta?.audio?.data) {
          res.write(`data: ${JSON.stringify({ type: "audio", data: delta.audio.data })}\n\n`);
        }
      }

      // Save assistant message
      await storage.createMessage(conversationId, "assistant", assistantTranscript);

      res.write(`data: ${JSON.stringify({ type: "done", transcript: assistantTranscript })}\n\n`);
      res.end();
      return;
    }

    // Standard text response
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))
      ],
    });

    const assistantContent = response.choices[0].message.content || "I'm thinking...";
    
    // Save assistant message
    const assistantMessage = await storage.createMessage(conversationId, "assistant", assistantContent);

    res.status(201).json(assistantMessage);
  });

  // --- Feedback ---
  app.post(api.conversations.feedback.generate.path, requireAuth, async (req, res) => {
    const conversationId = Number(req.params.id);
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await storage.getMessages(conversationId);
    const persona = await storage.getPersona(conversation.personaId);

    // System prompt for coaching
    const feedbackPrompt = `Analyze the following conversation between a Christian witness (User) and a ${persona?.name} (Assistant).
    Persona Description: ${persona?.description}.
    
    Provide concrete, encouraging feedback to the Christian witness.
    1. What did they do well?
    2. How could they improve their approach?
    3. Suggest specific scriptures or testimonies that might have been effective.
    4. Did they listen well?
    
    Keep the tone constructive and uplifting.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: feedbackPrompt },
        { role: "user", content: JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))) }
      ],
    });

    const feedbackContent = response.choices[0].message.content || "Could not generate feedback.";
    const feedback = await storage.createFeedback(conversationId, feedbackContent);
    
    res.status(201).json(feedback);
  });

  app.get(api.conversations.feedback.get.path, requireAuth, async (req, res) => {
    const conversationId = Number(req.params.id);
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    const feedback = await storage.getFeedback(conversationId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }
    
    res.json(feedback);
  });

  // --- LiveKit Voice Agent ---
  app.post("/api/livekit/token", requireAuth, async (req, res) => {
    const { conversationId } = req.body;
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    const conversation = await storage.getConversation(Number(conversationId));
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const persona = await storage.getPersona(conversation.personaId);
    if (!persona) {
      return res.status(404).json({ message: "Persona not found" });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(503).json({ message: "LiveKit is not configured on this server" });
    }

    const roomName = `conversation-${conversationId}-${Date.now()}`;
    const identity = (req.user as any).id;

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      metadata: JSON.stringify({
        personaName: persona.name,
        personaDescription: persona.description,
        conversationId: conversation.id,
      }),
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({ token, url: livekitUrl, roomName });
  });

  return httpServer;
}
