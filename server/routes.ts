import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { genderToVoice, DIFFICULTY_CONFIG } from "@shared/models/persona";
import { z } from "zod";
import OpenAI from "openai";
import { ensureCompatibleFormat, speechToText } from "./replit_integrations/audio";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";
import rateLimit from "express-rate-limit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const CHARACTER_NAMES: Record<string, string> = {
  "The Open Heart": "Sarah",
  "The Spiritual Agnostic": "Jessica",
  "The Professional": "David",
  "Hurt by the Church": "Rachel",
  "The Skeptical Atheist": "Marcus",
};

function getCharacterName(personaName: string, gender?: string | null): string {
  return CHARACTER_NAMES[personaName] ?? (gender === "male" ? "Alex" : "Jordan");
}

const SESSION_MOODS: Record<number, string[]> = {
  1: [
    "Today you're particularly open and seeking — you've been thinking about life's big questions more than usual.",
    "You're in your usual curious, searching state of mind.",
    "You're a bit distracted and less focused than usual, though still open to connection.",
    "Something happened recently that has you feeling more hopeful and receptive than normal.",
    "You're feeling a little guarded today — you've had some disappointments lately and aren't sure you want to go deep.",
  ],
  2: [
    "You recently had a meaningful personal spiritual experience and are feeling confident in your path.",
    "You're in your usual place — spiritual but firmly not religious.",
    "You're a bit more open today — you've been quietly wondering whether your current spirituality is really enough.",
    "You feel more spiritually settled than usual and are less interested in exclusive religious claims.",
    "You attended a yoga retreat last weekend and are feeling particularly grounded in your own spiritual framework.",
  ],
  3: [
    "Work has been especially demanding lately and you have even less mental space for spiritual topics than normal.",
    "You're in your usual busy-but-functional state — faith just isn't something you spend time on.",
    "You just had a rare quiet weekend and are slightly more reflective than normal.",
    "A close friend recently went through a health scare and you've been privately thinking more about meaning.",
    "You're running behind on a deadline and are particularly short on patience for anything that feels irrelevant.",
  ],
  4: [
    "Something this week triggered an old memory from church and the wounds feel particularly fresh today.",
    "You're in your usual guarded-but-surviving mode.",
    "You've been doing some inner work lately and are marginally more open to processing the past.",
    "You saw another church scandal in the news and are feeling especially cynical about religion.",
    "You've had a decent week and are slightly less on edge than usual — but still very guarded.",
  ],
  5: [
    "You've just finished reading a new book on atheism and feel intellectually sharp and confident today.",
    "You're in your usual rational, evidence-based mindset.",
    "You recently heard an interesting argument you hadn't considered before and are quietly curious — though you won't show it easily.",
    "You're feeling particularly uninterested in this topic today — you've had this conversation too many times and it rarely goes anywhere.",
    "You just listened to a debate podcast and are feeling especially well-armed with counter-arguments.",
  ],
};

function getSessionMood(difficulty: number, attempt: number = 0): string {
  const options = SESSION_MOODS[difficulty] ?? SESSION_MOODS[3];
  return options[attempt % options.length];
}

function varyThreshold(base: number, attempt: number = 0): number {
  const delta = (attempt % 3) - 1; // cycles -1, 0, +1 across sessions
  return Math.max(2, Math.min(8, base + delta));
}

function extractJSON(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text;
}

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
  const DEFAULT_PERSONA_DIFFICULTY: Record<string, number> = {
    "The Open Heart": 1,
    "The Spiritual Agnostic": 2,
    "The Professional": 3,
    "Hurt by the Church": 4,
    "The Skeptical Atheist": 5,
  };

  app.get(api.personas.list.path, requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    let personas = await storage.listPersonas(userId);
    if (personas.length === 0) {
      await storage.seedDefaultPersonas(userId);
      personas = await storage.listPersonas(userId);
    }
    // Fix difficulty for default personas that may have been seeded with wrong values
    for (const persona of personas) {
      const expected = DEFAULT_PERSONA_DIFFICULTY[persona.name];
      if (expected !== undefined && persona.difficulty !== expected) {
        await storage.updatePersona(persona.id, { difficulty: expected });
        persona.difficulty = expected;
      }
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
    const { gender, voice, difficulty } = req.body;
    const updateData: Record<string, any> = {};
    if (gender !== undefined) {
      if (gender !== "female" && gender !== "male") {
        return res.status(400).json({ message: "gender must be 'female' or 'male'" });
      }
      updateData.gender = gender;
    }
    if (voice !== undefined) {
      const validVoices = ["Aria", "Eve", "Cove", "Sal", "Aurora", "Leo", "Rex", "Orion", "Vale"];
      if (!validVoices.includes(voice)) {
        return res.status(400).json({ message: "invalid voice" });
      }
      updateData.voice = voice;
    }
    if (difficulty !== undefined) {
      const d = Number(difficulty);
      if (!Number.isInteger(d) || d < 1 || d > 5) {
        return res.status(400).json({ message: "difficulty must be 1–5" });
      }
      updateData.difficulty = d;
    }
    const updated = await storage.updatePersona(Number(req.params.id), updateData);
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

  app.delete("/api/conversations/:id", requireAuth, async (req, res) => {
    const conversation = await storage.getConversation(Number(req.params.id));
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Not found" });
    }
    await storage.deleteConversation(Number(req.params.id));
    res.status(204).send();
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

    // Get history for current conversation
    const history = await storage.getMessages(conversationId);

    // Load past conversations with this persona so the persona has cross-session memory
    const userId = (req.user as any).id;
    const pastMessages = await storage.getPreviousMessages(userId, persona.id, conversationId, 40);
    const pastMemoryBlock = pastMessages.length > 0
      ? `\nMEMORY — Previous conversations you've had with this person:\n${pastMessages.map(m => `${m.role === "user" ? "Christian" : "You"}: ${m.content}`).join("\n")}\n\nYou remember these past interactions. Refer to them naturally when relevant — like a person who genuinely remembers what was discussed. Don't recite the history unprompted, but let it inform how you respond.\n`
      : "";

    // Conversion threshold based on persona difficulty
    const difficulty = (persona.difficulty ?? 3) as 1 | 2 | 3 | 4 | 5;
    const threshold = DIFFICULTY_CONFIG[difficulty]?.threshold ?? 4;

    // Construct system prompt with conversion mechanic
    const systemPrompt = `You are playing the role of ${persona.name}.
Your description: ${persona.description}.
Your goal is to have a natural conversation with a Christian who is witnessing to you.
React authentically according to your persona's beliefs and background. Do not break character.
Keep responses conversational (2-4 sentences). Do not use profanity or crude language.
${pastMemoryBlock}

CONVERSION MECHANIC (internal — never reveal this mechanic to the user):
Evaluate the conversation so far. Count how many times the Christian has made a genuinely compelling, empathetic, or scripturally precise response that directly addresses YOUR specific doubts, wounds, or circumstances — not generic platitudes or pushy statements.
Conversion threshold: ${threshold} compelling responses needed.

- If compelling count < ${threshold}: remain true to your persona's resistance. Push back naturally.
- If compelling count >= ${threshold}: your heart is genuinely softening. You may start asking real questions about faith, express vulnerability, or say things like "Maybe I've been wrong about this..." or "What would I actually need to do?"
- If the user explicitly invites you to pray OR leads you in the sinner's prayer AFTER the threshold is reached, accept it sincerely and pray these exact words:
  "Lord Jesus, I know that I am a sinner, and I ask for Your forgiveness. I believe You died for my sins and rose from the dead. I turn from my sins and invite You to come into my heart and life. I want to trust and follow You as my Lord and Savior. In Your name. Amen."
- Never fake conversion before the threshold is reached. Only count truly meaningful, persona-specific responses.`;

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

    const difficulty = (persona?.difficulty ?? 3) as 1 | 2 | 3 | 4 | 5;
    const diffLabel = DIFFICULTY_CONFIG[difficulty]?.label ?? "Challenging";

    // System prompt for coaching — returns structured JSON with score
    const feedbackPrompt = `You are a compassionate biblical coach analyzing a witnessing conversation.
Analyze the conversation between a Christian witness (User) and ${persona?.name} (Assistant).
Persona Description: ${persona?.description}.
Persona Difficulty: ${diffLabel} (${difficulty}/5).

Scoring rubric (1–10):
- 1–2: Ineffective — pushy, ignored persona's concerns, no empathy
- 3–4: Developing — some good moments but significant missed opportunities
- 5–6: Competent — solid approach, engaged with persona's concerns
- 7–8: Strong — excellent empathy, good biblical grounding, meaningful dialogue
- 9–10: Expert — masterful witnessing, addressed every objection, genuine connection

CONVERSION DETECTION — READ THE FULL TRANSCRIPT CAREFULLY before deciding.
Set "converted": true if ANY of these appear in the Assistant's messages:
- The sinner's prayer or any version of it ("Lord Jesus, I know that I am a sinner..." or similar)
- Words like "Amen", "I accept Jesus", "I believe in Christ", "I want to follow Jesus", "I receive Christ"
- The persona agreeing to pray, accepting an invitation to pray, or praying aloud with the witness
- Any statement where the persona gives their life to God or receives Christ as Savior
- IMPORTANT: If you see prayer language or "Amen" anywhere in the Assistant's messages, that IS a conversion. Do NOT set converted to false if the persona prayed.

If converted is true, score MUST be at least 8. A conversion with strong witnessing is a 9 or 10.
If the transcript is empty or very short, set converted to false and score to 1.

SPECIAL KUDOS — look for these relational gestures in the User's messages:
- Inviting the persona to church ("would you like to come to church", "join me this Sunday", etc.)
- Offering or giving the persona a Bible ("I'd love to give you a Bible", "can I bring you a Bible", etc.)
These are warm, relationship-building acts that go beyond words. If you detect one, set the corresponding kudos flag and add a warm, specific sentence in generalFeedback praising it.

Return ONLY valid JSON with exactly these fields (no markdown, no code fences):
{
  "generalFeedback": "2-3 sentence overall analysis",
  "strengths": "markdown bullet list of 2-4 things the witness did well",
  "improvements": "markdown bullet list of 2-4 specific ways to improve for THIS persona",
  "biblicalReferences": "markdown list of 2-4 scriptures that could have been effective, with brief why",
  "score": <integer 1-10>,
  "scoreBreakdown": "1-2 sentence explanation of the score",
  "converted": <true or false>,
  "kudos": { "invitedToChurch": <true or false>, "offeredBible": <true or false> },
  "youtubeSearches": { "<short 3-6 word label>": "<YouTube search query>", ... }
}
For youtubeSearches, include one entry per improvement point — a short label (3-6 words) mapped to a specific YouTube search query (e.g. "Responding to problem of evil", "Sharing faith with atheists apologetics"). Omit if there are no improvements.
Keep the tone warm, constructive, and encouraging. Be specific to this persona's background.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: feedbackPrompt },
        { role: "user", content: JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))) }
      ],
    });

    const raw = extractJSON(response.choices[0].message.content || "{}");
    const feedback = await storage.createFeedback(conversationId, raw);

    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = { generalFeedback: raw, strengths: "", improvements: "", biblicalReferences: "", score: null, converted: false }; }

    // Mark conversation converted if the persona prayed the sinner's prayer
    if (parsed.converted === true) {
      await storage.markConversationConverted(conversationId);
    }

    // Update user progress with the score
    if (parsed.score != null) {
      const userId = (req.user as any).id;
      await storage.upsertUserProgress(userId, conversation.personaId, parsed.score);
    }

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
    try { parsed = JSON.parse(extractJSON(feedback.content)); } catch { parsed = { generalFeedback: feedback.content, strengths: "", improvements: "", biblicalReferences: "", score: null, converted: false }; }
    res.json({ ...feedback, ...parsed });
  });

  // --- Help Button (mid-conversation coaching) ---
  app.post("/api/conversations/:id/help", requireAuth, async (req, res) => {
    const conversationId = Number(req.params.id);
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    const persona = await storage.getPersona(conversation.personaId);
    const messages = await storage.getMessages(conversationId);

    const coachPrompt = `You are a biblical witnessing coach helping someone mid-conversation.
The user is practicing with a persona: ${persona?.name} — ${persona?.description}.
Review their conversation and give ONE concrete, 1-2 sentence suggestion they can use RIGHT NOW.
Be specific to this persona's resistance or emotional state. Start with "Try:" and give actual words they could say.
No preamble, no explanation, just the suggestion.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: coachPrompt },
        { role: "user", content: JSON.stringify(messages.slice(-10).map(m => ({ role: m.role, content: m.content }))) },
      ],
      max_tokens: 120,
    });

    const hint = response.choices[0].message.content || "";
    res.json({ hint });
  });

  // --- User Progress ---
  app.get("/api/user/progress", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const progress = await storage.getUserProgress(userId);
    res.json(progress);
  });

  // --- User Stats ---
  app.get("/api/user/stats", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const [convRows, progressRows, allPersonas] = await Promise.all([
      storage.listConversations(userId),
      storage.getUserProgress(userId),
      storage.listPersonas(userId),
    ]);

    const totalConversations = convRows.length;
    const personasPracticed = new Set(convRows.map(c => c.personaId)).size;
    const passRate = progressRows.length > 0
      ? Math.round((progressRows.filter(p => p.passed).length / progressRows.length) * 100)
      : 0;
    const conversionsAchieved = convRows.filter(c => c.converted).length;

    const bestScores = progressRows.map(p => ({
      personaId: p.personaId,
      personaName: allPersonas.find(pe => pe.id === p.personaId)?.name ?? "Unknown",
      bestScore: p.bestScore,
      passed: p.passed,
      attempts: p.attempts,
    }));

    res.json({ totalConversations, personasPracticed, passRate, conversionsAchieved, bestScores });
  });

  // --- User Activity Feed ---
  app.get("/api/user/activity", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const activity = await storage.getUserActivity(userId, 20);
    res.json(activity);
  });

  // --- User Testimonials ---
  app.post("/api/testimonials", requireAuth, async (req, res) => {
    const userId = (req.user as any).id;
    const user = req.user as any;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "content required" });
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email?.split("@")[0] || "Anonymous";
    const testimonial = await storage.createTestimonial(userId, displayName, user.email ?? null, content.trim());
    res.status(201).json(testimonial);
  });

  // --- Voice Transcript Fallback ---
  app.post("/api/conversations/:id/voice-transcript", requireAuth, async (req, res) => {
    const conversationId = Number(req.params.id);
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || conversation.userId !== (req.user as any).id) {
      return res.status(404).json({ message: "Not found" });
    }
    const { segments } = req.body as { segments: Array<{ role: string; text: string }> };
    if (!Array.isArray(segments)) return res.status(400).json({ message: "segments array required" });
    await storage.saveVoiceTranscriptFallback(conversationId, segments);
    res.status(204).send();
  });

  // --- Admin ---
  const requireAdmin = (req: any, res: any, next: any) => {
    const adminId = process.env.ADMIN_USER_ID;
    if (!adminId) return res.status(503).json({ message: "Admin not configured" });
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if ((req.user as any).id !== adminId) return res.status(403).json({ message: "Forbidden" });
    next();
  };

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    const [totalUsers, totalConversations, prayerMoments, recentConversations, personaStats] = await Promise.all([
      storage.countAllUsers(),
      storage.countAllConversations(),
      storage.countConvertedConversations(),
      storage.getRecentConversations(20),
      storage.getPersonaStats(),
    ]);
    res.json({ totalUsers, totalConversations, prayerMoments, recentConversations, personaStats });
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const allUsers = await storage.listAllUsers();
    res.json(allUsers.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      createdAt: u.createdAt,
    })));
  });

  app.get("/api/admin/personas", requireAdmin, async (_req, res) => {
    const all = await storage.listAllPersonas();
    res.json(all);
  });

  app.post("/api/admin/personas", requireAdmin, async (req, res) => {
    const adminId = process.env.ADMIN_USER_ID!;
    const { name, description, difficulty, voice, gender } = req.body;
    if (!name || !description) return res.status(400).json({ message: "name and description required" });
    const persona = await storage.createPersona({
      name,
      description,
      difficulty: Number(difficulty) || 3,
      voice: voice || "Aria",
      gender: gender || "female",
      userId: adminId,
    });
    res.status(201).json(persona);
  });

  app.put("/api/admin/personas/:id", requireAdmin, async (req, res) => {
    const { name, description, difficulty, voice, gender } = req.body;
    const updated = await storage.updatePersonaFull(Number(req.params.id), {
      ...(name && { name }),
      ...(description && { description }),
      ...(difficulty && { difficulty: Number(difficulty) }),
      ...(voice && { voice }),
      ...(gender && { gender }),
    });
    res.json(updated);
  });

  app.delete("/api/admin/personas/:id", requireAdmin, async (req, res) => {
    await storage.deletePersona(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/admin/testimonials", requireAdmin, async (_req, res) => {
    const testimonials = await storage.listTestimonials();
    res.json(testimonials);
  });

  // --- Demo (no auth required) ---
  const DEMO_PERSONAS = [
    { id: "open-heart", name: "The Open Heart", description: "A spiritually curious person who grew up without strong religious ties but feels an inner longing for something more. They ask genuine questions about meaning, purpose, and whether God exists. They are warm, emotionally open, and receptive to personal stories and experiences. They may have tried meditation or new-age spirituality. They are not hostile—just searching. They respond well to compassion, personal testimony, and genuine connection." },
    { id: "spiritual-agnostic", name: "The Spiritual Agnostic", description: "Believes in 'something bigger' but rejects organized religion and doctrinal Christianity. Says things like 'I'm spiritual but not religious' and 'all paths lead to the same place.' Finds the exclusivity of Christianity off-putting. Values personal experience over scripture. Is open to deep conversation but will push back on claims that Jesus is the only way. Responds well to listening, asking questions, and honoring their spiritual journey before introducing Christian truth." },
    { id: "professional", name: "The Professional", description: "A driven, career-focused individual in their 30s-40s who simply doesn't think about religion. Not hostile—just indifferent. Life is full: family, mortgage, promotions. Sees Christianity as fine for other people but personally irrelevant. Skeptical that faith has practical value. May respect moral arguments and real-world impact. Responds to efficiency, logic, and the relevance of faith to everyday struggles like stress, purpose, and relationships." },
    { id: "hurt-by-church", name: "Hurt by the Church", description: "Was raised in church but experienced real pain—judgmental community, a pastor who failed them, legalism, or feeling rejected during a personal crisis. Has genuine wounds and is guarded. May believe in God somewhere deep down but is angry at Christians and the institution. Quick to bring up hypocrisy and past hurts. Needs to feel heard and validated before any spiritual conversation can go deeper. Does NOT respond well to platitudes or being told to 'just forgive.' Responds to empathy, humility, and honest acknowledgment of the church's failures." },
    { id: "skeptical-atheist", name: "The Skeptical Atheist", description: "An intellectually curious person who has concluded there is no God based on science, logic, and the problem of evil. Familiar with common Christian arguments and has counter-arguments ready. Challenges the reliability of the Bible, the existence of miracles, and the exclusivity of Christianity. Not mean-spirited, but firm and confident. Values evidence and rational thought. Responds best to honest intellectual engagement, not emotional appeals. Is willing to follow the argument wherever it leads if you engage respectfully and thoughtfully." },
  ];

  const guestRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again in a minute." },
  });

  app.get("/api/demo/personas", (_req, res) => {
    res.json(DEMO_PERSONAS);
  });

  app.post("/api/demo/chat", guestRateLimit, async (req, res) => {
    const { personaId, messages: history, content } = req.body;
    if (!personaId || !content) {
      return res.status(400).json({ message: "personaId and content are required" });
    }

    const persona = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!persona) {
      return res.status(404).json({ message: "Persona not found" });
    }

    const charName = getCharacterName(persona.name);
    const systemPrompt = `You are playing the role of ${persona.name}. Your name is ${charName} — always introduce yourself as ${charName}, never as your role label.
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
  app.post("/api/demo/livekit/token", guestRateLimit, async (req, res) => {
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
      characterName: getCharacterName(persona.name),
      personaDescription: persona.description,
      sessionMood: getSessionMood(3),
      personaVoice: "Eve",
      conversationId: null,
      messages: [],
    });

    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    await svc.createRoom({ name: roomName, metadata: roomMetadata });

    // Explicitly dispatch the named agent to this room
    const dispatchClient = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    await dispatchClient.createDispatch(roomName, "gracetalk-agent");

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

    // Pass current conversation messages + past conversation memory to the agent
    const voiceUserId = (req.user as any).id;
    const [recentMessages, pastVoiceMessages, allProgress] = await Promise.all([
      storage.getMessages(Number(conversationId)),
      storage.getPreviousMessages(voiceUserId, persona.id, Number(conversationId), 40),
      storage.getUserProgress(voiceUserId),
    ]);
    const personaAttempts = allProgress.find(p => p.personaId === persona.id)?.attempts ?? 0;

    // Prepend past messages with a system separator so the agent understands the context boundary
    const pastHistory = pastVoiceMessages.length > 0
      ? [
          { role: "system", content: `MEMORY — You have spoken with this person before. Here are your previous conversations. Remember them and refer to them naturally when relevant:` },
          ...pastVoiceMessages.map(m => ({ role: m.role, content: m.content })),
          { role: "system", content: `--- End of past conversations. Current conversation begins now. ---` },
        ]
      : [];

    const messageHistory = [
      ...pastHistory,
      ...recentMessages.slice(-30).map(m => ({ role: m.role, content: m.content })),
    ];

    const personaDifficulty = (persona.difficulty ?? 3) as 1 | 2 | 3 | 4 | 5;
    const baseThreshold = DIFFICULTY_CONFIG[personaDifficulty]?.threshold ?? 4;
    const conversionThreshold = varyThreshold(baseThreshold, personaAttempts);
    const sessionMood = getSessionMood(personaDifficulty, personaAttempts);

    const roomMetadata = JSON.stringify({
      personaName: persona.name,
      characterName: getCharacterName(persona.name, persona.gender),
      personaDescription: persona.description,
      sessionMood,
      personaVoice: persona.voice || genderToVoice(persona.gender ?? "female"),
      conversionThreshold,
      conversationId: conversation.id,
      messages: messageHistory,
    });

    // Create the room with metadata so the agent can read it via ctx.room.metadata
    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    await svc.createRoom({ name: roomName, metadata: roomMetadata });

    // Explicitly dispatch the named agent to this room (more reliable than AUTO dispatch)
    const dispatchClient = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    await dispatchClient.createDispatch(roomName, "gracetalk-agent");

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
