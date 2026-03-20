import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { genderToVoice } from "@shared/models/persona";
import { z } from "zod";
import OpenAI from "openai";
import { ensureCompatibleFormat, speechToText } from "./replit_integrations/audio";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Set up auth
  await setupAuth(app);
  registerAuthRoutes(app);

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
    const userId = (req.user as any).id;
    let personas = await storage.listPersonas(userId);
    if (personas.length === 0) {
      await storage.seedDefaultPersonas(userId);
      personas = await storage.listPersonas(userId);
    }
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

  app.patch(api.personas.update.path, requireAuth, async (req, res) => {
    const persona = await storage.getPersona(Number(req.params.id));
    if (!persona || persona.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Persona not found" });
    }
    const { gender } = req.body;
    if (gender !== "female" && gender !== "male") {
      return res.status(400).json({ message: "gender must be 'female' or 'male'" });
    }
    const updated = await storage.updatePersona(Number(req.params.id), { gender });
    res.json(updated);
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

    const userId = (req.user as any).id;

    // Reuse the most recent empty conversation for this persona instead of
    // accumulating duplicate blank sessions
    const existing = await storage.listConversations(userId);
    const emptyMatch = existing.find(
      (c) => c.personaId === personaId && c.messageCount === 0
    );
    if (emptyMatch) {
      return res.status(201).json(emptyMatch);
    }

    const conversation = await storage.createConversation(
      userId,
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

    // System prompt for coaching — returns structured JSON
    const feedbackPrompt = `You are a compassionate biblical coach analyzing a witnessing conversation.
Analyze the conversation between a Christian witness (User) and ${persona?.name} (Assistant).
Persona Description: ${persona?.description}.

Return ONLY valid JSON with exactly these four fields (no markdown, no code fences):
{
  "generalFeedback": "2-3 sentence overall analysis of how the conversation went",
  "strengths": "markdown bullet list of 2-4 things the witness did well",
  "improvements": "markdown bullet list of 2-4 specific ways to improve approach",
  "biblicalReferences": "markdown list of 2-4 specific scriptures or examples that could have been effective, with brief explanation of why"
}
Keep the tone warm, constructive, and encouraging.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: feedbackPrompt },
        { role: "user", content: JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))) }
      ],
    });

    const raw = response.choices[0].message.content || "{}";
    // Store raw JSON string in content field
    const feedback = await storage.createFeedback(conversationId, raw);

    // Parse and return structured fields
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { generalFeedback: raw, strengths: "", improvements: "", biblicalReferences: "" }; }
    res.status(201).json({ ...feedback, ...parsed });
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

    let parsed: any = {};
    try { parsed = JSON.parse(feedback.content); } catch { parsed = { generalFeedback: feedback.content, strengths: "", improvements: "", biblicalReferences: "" }; }
    res.json({ ...feedback, ...parsed });
  });

  // --- Demo (no auth required) ---
  const DEMO_PERSONAS = [
    { id: "open-heart", name: "The Open Heart", description: "A spiritually curious person who grew up without strong religious ties but feels an inner longing for something more. They ask genuine questions about meaning, purpose, and whether God exists. They are warm, emotionally open, and receptive to personal stories and experiences. They may have tried meditation or new-age spirituality. They are not hostile—just searching. They respond well to compassion, personal testimony, and genuine connection." },
    { id: "spiritual-agnostic", name: "The Spiritual Agnostic", description: "Believes in 'something bigger' but rejects organized religion and doctrinal Christianity. Says things like 'I'm spiritual but not religious' and 'all paths lead to the same place.' Finds the exclusivity of Christianity off-putting. Values personal experience over scripture. Is open to deep conversation but will push back on claims that Jesus is the only way. Responds well to listening, asking questions, and honoring their spiritual journey before introducing Christian truth." },
    { id: "professional", name: "The Professional", description: "A driven, career-focused individual in their 30s-40s who simply doesn't think about religion. Not hostile—just indifferent. Life is full: family, mortgage, promotions. Sees Christianity as fine for other people but personally irrelevant. Skeptical that faith has practical value. May respect moral arguments and real-world impact. Responds to efficiency, logic, and the relevance of faith to everyday struggles like stress, purpose, and relationships." },
    { id: "hurt-by-church", name: "Hurt by the Church", description: "Was raised in church but experienced real pain—judgmental community, a pastor who failed them, legalism, or feeling rejected during a personal crisis. Has genuine wounds and is guarded. May believe in God somewhere deep down but is angry at Christians and the institution. Quick to bring up hypocrisy and past hurts. Needs to feel heard and validated before any spiritual conversation can go deeper. Does NOT respond well to platitudes or being told to 'just forgive.' Responds to empathy, humility, and honest acknowledgment of the church's failures." },
    { id: "skeptical-atheist", name: "The Skeptical Atheist", description: "An intellectually curious person who has concluded there is no God based on science, logic, and the problem of evil. Familiar with common Christian arguments and has counter-arguments ready. Challenges the reliability of the Bible, the existence of miracles, and the exclusivity of Christianity. Not mean-spirited, but firm and confident. Values evidence and rational thought. Responds best to honest intellectual engagement, not emotional appeals. Is willing to follow the argument wherever it leads if you engage respectfully and thoughtfully." },
  ];

  app.get("/api/demo/personas", (_req, res) => {
    res.json(DEMO_PERSONAS);
  });

  app.post("/api/demo/chat", async (req, res) => {
    const { personaId, messages: history, content } = req.body;
    if (!personaId || !content) {
      return res.status(400).json({ message: "personaId and content are required" });
    }

    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) {
      return res.status(404).json({ message: "Persona not found" });
    }

    const systemPrompt = `You are playing the role of ${persona.name}.
Your description: ${persona.description}.
Your goal is to have a natural conversation with a Christian who is witnessing to you.
React according to your persona's beliefs and background. Do not break character.
Keep responses conversational (2-4 sentences). If they make a good point, acknowledge it but stay true to your beliefs.`;

    const chatHistory = Array.isArray(history)
      ? history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      : [];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory,
        { role: "user", content },
      ],
    });

    const reply = response.choices[0].message.content || "...";
    res.json({ role: "assistant", content: reply });
  });

  // --- Demo LiveKit token (no auth required) ---
  app.post("/api/demo/livekit/token", async (req, res) => {
    const { personaId } = req.body;
    if (!personaId) return res.status(400).json({ message: "personaId is required" });

    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) return res.status(404).json({ message: "Persona not found" });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(503).json({ message: "LiveKit is not configured" });
    }

    const roomName = `demo-${personaId}-${Date.now()}`;
    const identity = `guest-${Date.now()}`;

    const roomMetadata = JSON.stringify({
      personaName: persona.name,
      personaDescription: persona.description,
      personaVoice: "Eve",
      conversationId: null,
      messages: [],
    });

    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    await svc.createRoom({ name: roomName, metadata: roomMetadata });

    const at = new AccessToken(apiKey, apiSecret, { identity, metadata: roomMetadata });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();

    res.json({ token, url: livekitUrl, roomName });
  });

  // --- Agent callback (agent saves voice transcripts back to the DB) ---
  app.post("/api/agent/conversations/:id/messages", async (req, res) => {
    const secret = req.headers["x-agent-secret"];
    if (!secret || secret !== process.env.GRACETALK_AGENT_SECRET) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const conversationId = Number(req.params.id);
    const { role, content } = req.body;
    if (!role || !content) {
      return res.status(400).json({ message: "role and content required" });
    }
    const message = await storage.createMessage(conversationId, role, content);
    res.status(201).json(message);
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

    // Pass recent messages so the agent has full conversation context
    const recentMessages = await storage.getMessages(conversationId);
    const messageHistory = recentMessages.slice(-30).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const roomMetadata = JSON.stringify({
      personaName: persona.name,
      personaDescription: persona.description,
      personaVoice: genderToVoice(persona.gender ?? "female"),
      conversationId: conversation.id,
      messages: messageHistory,
    });

    // Create the room with metadata so the agent can read it via ctx.room.metadata
    // Agent auto-joins via WorkerOptions AUTO mode (no explicit dispatch needed)
    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    await svc.createRoom({ name: roomName, metadata: roomMetadata });

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      metadata: roomMetadata,
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
