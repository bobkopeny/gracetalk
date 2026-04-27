import { users, personas, conversations, messages, feedbacks, userProgress, userTestimonials } from "@shared/schema";
import type { User, UpsertUser, Persona, InsertPersona, Conversation, Message, Feedback, UserProgress, UserTestimonial } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, count, gte, sql } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Personas
  createPersona(persona: InsertPersona & { userId: string }): Promise<Persona>;
  getPersona(id: number): Promise<Persona | undefined>;
  listPersonas(userId: string): Promise<Persona[]>;
  updatePersona(id: number, data: Partial<Pick<Persona, "gender" | "voice" | "difficulty">>): Promise<Persona>;
  markConversationConverted(id: number): Promise<void>;
  deletePersona(id: number): Promise<void>;

  // Chat
  createConversation(userId: string, personaId: number, title: string): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  listConversations(userId: string): Promise<(Conversation & { personaName: string; messageCount: number; lastMessage: string | null })[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
  getMessages(conversationId: number): Promise<Message[]>;

  // Conversations
  deleteConversation(id: number): Promise<void>;

  // Feedback
  createFeedback(conversationId: number, content: string): Promise<Feedback>;
  getFeedback(conversationId: number): Promise<Feedback | undefined>;

  // Progress
  upsertUserProgress(userId: string, personaId: number, score: number, lastMoodIndex?: number): Promise<void>;
  getUserProgress(userId: string): Promise<UserProgress[]>;

  // Cross-conversation memory
  getPreviousMessages(userId: string, personaId: number, excludeConversationId: number, limit: number): Promise<Message[]>;

  // Testimonials
  createTestimonial(userId: string, displayName: string, email: string | null, content: string): Promise<UserTestimonial>;
  listTestimonials(): Promise<UserTestimonial[]>;

  // User activity feed
  getUserActivity(userId: string, limit: number): Promise<Array<{ type: "started" | "prayer"; personaName: string; timestamp: string }>>;

  // Full persona update (admin)
  updatePersonaFull(id: number, data: Partial<Pick<Persona, "name" | "description" | "gender" | "voice" | "difficulty">>): Promise<Persona>;

  // Voice transcript fallback (save client segments if agent didn't)
  saveVoiceTranscriptFallback(conversationId: number, segments: Array<{ role: string; text: string }>): Promise<void>;

  // Admin
  countAllUsers(): Promise<number>;
  countAllConversations(): Promise<number>;
  countConvertedConversations(): Promise<number>;
  getRecentConversations(limit: number): Promise<(Conversation & { personaName: string; lastMessage: string | null })[]>;
  listAllPersonas(): Promise<Persona[]>;
  listAllUsers(): Promise<User[]>;
  getPersonaStats(): Promise<Array<{ personaName: string; difficulty: number | null; totalSessions: number; prayerMoments: number }>>;
  getUserPeriodStats(): Promise<{ lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number }>;
  getConversationPeriodStats(): Promise<{ lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number }>;
  deleteAllConversations(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createPersona(persona: InsertPersona & { userId: string }): Promise<Persona> {
    const [newPersona] = await db.insert(personas).values(persona).returning();
    return newPersona;
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    const [persona] = await db.select().from(personas).where(eq(personas.id, id));
    return persona;
  }

  async listPersonas(userId: string): Promise<Persona[]> {
    return db.select().from(personas).where(eq(personas.userId, userId)).orderBy(asc(personas.difficulty), asc(personas.createdAt));
  }

  async updatePersona(id: number, data: Partial<Pick<Persona, "gender" | "voice" | "difficulty">>): Promise<Persona> {
    const [updated] = await db.update(personas).set(data).where(eq(personas.id, id)).returning();
    return updated;
  }

  async markConversationConverted(id: number): Promise<void> {
    await db.update(conversations).set({ converted: true }).where(eq(conversations.id, id));
  }

  async deletePersona(id: number): Promise<void> {
    await db.delete(personas).where(eq(personas.id, id));
  }

  async seedDefaultPersonas(userId: string): Promise<void> {
    const defaults: { name: string; description: string; gender: "female" | "male"; voice: string; difficulty: number }[] = [
      {
        name: "The Open Heart",
        gender: "female",
        voice: "Aria",
        difficulty: 1,
        description:
          "A spiritually curious person who grew up without strong religious ties but feels an inner longing for something more. They ask genuine questions about meaning, purpose, and whether God exists. They are warm, emotionally open, and receptive to personal stories and experiences. They may have tried meditation or new-age spirituality. They are not hostile—just searching. They respond well to compassion, personal testimony, and genuine connection.",
      },
      {
        name: "The Spiritual Agnostic",
        gender: "female" as const,
        voice: "Eve",
        difficulty: 2,
        description:
          "Believes in 'something bigger' but rejects organized religion and doctrinal Christianity. Says things like 'I'm spiritual but not religious' and 'all paths lead to the same place.' Finds the exclusivity of Christianity off-putting. Values personal experience over scripture. Is open to deep conversation but will push back on claims that Jesus is the only way. Responds well to listening, asking questions, and honoring their spiritual journey before introducing Christian truth.",
      },
      {
        name: "The Professional",
        gender: "male" as const,
        voice: "Leo",
        difficulty: 3,
        description:
          "A driven, career-focused individual in their 30s-40s who simply doesn't think about religion. Not hostile—just indifferent. Life is full: family, mortgage, promotions. Sees Christianity as fine for other people but personally irrelevant. Skeptical that faith has practical value. May respect moral arguments and real-world impact. Responds to efficiency, logic, and the relevance of faith to everyday struggles like stress, purpose, and relationships.",
      },
      {
        name: "Hurt by the Church",
        gender: "female" as const,
        voice: "Sal",
        difficulty: 4,
        description:
          "Was raised in church but experienced real pain—judgmental community, a pastor who failed them, legalism, or feeling rejected during a personal crisis. Has genuine wounds and is guarded. May believe in God somewhere deep down but is angry at Christians and the institution. Quick to bring up hypocrisy and past hurts. Needs to feel heard and validated before any spiritual conversation can go deeper. Does NOT respond well to platitudes or being told to 'just forgive.' Responds to empathy, humility, and honest acknowledgment of the church's failures.",
      },
      {
        name: "The Skeptical Atheist",
        gender: "male" as const,
        voice: "Rex",
        difficulty: 5,
        description:
          "An intellectually curious person who has concluded there is no God based on science, logic, and the problem of evil. Familiar with common Christian arguments and has counter-arguments ready. Challenges the reliability of the Bible, the existence of miracles, and the exclusivity of Christianity. Not mean-spirited, but firm and confident. Values evidence and rational thought. Responds best to honest intellectual engagement, not emotional appeals. Is willing to follow the argument wherever it leads if you engage respectfully and thoughtfully.",
      },
    ];

    await db.insert(personas).values(
      defaults.map((p) => ({ ...p, userId }))
    );
  }

  async createConversation(userId: string, personaId: number, title: string): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values({ userId, personaId, title }).returning();
    return conversation;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async listConversations(userId: string): Promise<(Conversation & { personaName: string; messageCount: number; lastMessage: string | null })[]> {
    const rows = await db
      .select({
        conversation: conversations,
        personaName: sql<string>`COALESCE(${personas.name}, 'Unknown Persona')`,
        messageCount: count(messages.id),
        lastMessage: sql<string | null>`(
          SELECT content FROM messages
          WHERE conversation_id = ${conversations.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
      })
      .from(conversations)
      .leftJoin(personas, eq(conversations.personaId, personas.id))
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId))
      .groupBy(conversations.id, personas.name)
      .orderBy(desc(conversations.createdAt));

    return rows.map(row => ({
      ...row.conversation,
      personaName: row.personaName,
      messageCount: row.messageCount,
      lastMessage: row.lastMessage,
    }));
  }

  async createMessage(conversationId: number, role: string, content: string): Promise<Message> {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  async createFeedback(conversationId: number, content: string): Promise<Feedback> {
    await db.delete(feedbacks).where(eq(feedbacks.conversationId, conversationId));
    const [feedback] = await db.insert(feedbacks).values({ conversationId, content }).returning();
    return feedback;
  }

  async getFeedback(conversationId: number): Promise<Feedback | undefined> {
    const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.conversationId, conversationId)).orderBy(desc(feedbacks.createdAt));
    return feedback;
  }

  async upsertUserProgress(userId: string, personaId: number, score: number, lastMoodIndex?: number): Promise<void> {
    await db
      .insert(userProgress)
      .values({ userId, personaId, bestScore: score, passed: score >= 7, attempts: 1, lastMoodIndex: lastMoodIndex ?? null })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.personaId],
        set: {
          bestScore: sql`GREATEST(user_progress.best_score, ${score})`,
          passed: sql`user_progress.passed OR ${score >= 7}`,
          attempts: sql`user_progress.attempts + 1`,
          lastMoodIndex: lastMoodIndex ?? null,
          updatedAt: new Date(),
        },
      });
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return db.select().from(userProgress).where(eq(userProgress.userId, userId));
  }

  async getPreviousMessages(userId: string, personaId: number, excludeConversationId: number, limit: number): Promise<Message[]> {
    // Get messages from past conversations with this persona, most recent conversations first
    const rows = await db
      .select({ message: messages })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.personaId, personaId),
          sql`${conversations.id} != ${excludeConversationId}`,
          sql`${messages.content} != ''`
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Return in chronological order so the context reads naturally
    return rows.map(r => r.message).reverse();
  }

  async createTestimonial(userId: string, displayName: string, email: string | null, content: string): Promise<UserTestimonial> {
    const [t] = await db.insert(userTestimonials).values({ userId, displayName, email, content }).returning();
    return t;
  }

  async listTestimonials(): Promise<UserTestimonial[]> {
    return db.select().from(userTestimonials).orderBy(desc(userTestimonials.createdAt));
  }

  async getUserActivity(userId: string, limit: number): Promise<Array<{ type: "started" | "prayer"; personaName: string; timestamp: string }>> {
    const convRows = await db
      .select({ conversation: conversations, personaName: personas.name })
      .from(conversations)
      .innerJoin(personas, eq(conversations.personaId, personas.id))
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);

    const events: Array<{ type: "started" | "prayer"; personaName: string; timestamp: string }> = [];
    for (const row of convRows) {
      if (row.conversation.converted) {
        events.push({ type: "prayer", personaName: row.personaName, timestamp: row.conversation.createdAt.toISOString() });
      }
      events.push({ type: "started", personaName: row.personaName, timestamp: row.conversation.createdAt.toISOString() });
    }
    return events.slice(0, limit);
  }

  async updatePersonaFull(id: number, data: Partial<Pick<Persona, "name" | "description" | "gender" | "voice" | "difficulty">>): Promise<Persona> {
    const [updated] = await db.update(personas).set(data).where(eq(personas.id, id)).returning();
    return updated;
  }

  async saveVoiceTranscriptFallback(conversationId: number, segments: Array<{ role: string; text: string }>): Promise<void> {
    const existing = await db.select({ content: messages.content }).from(messages).where(eq(messages.conversationId, conversationId));
    const savedContents = new Set(existing.map(m => m.content.trim()));
    for (const seg of segments) {
      const text = seg.text.trim();
      if (text && !savedContents.has(text)) {
        await db.insert(messages).values({ conversationId, role: seg.role === "user" ? "user" : "assistant", content: text });
        savedContents.add(text);
      }
    }
  }

  async countAllUsers(): Promise<number> {
    const [row] = await db.select({ n: count(users.id) }).from(users);
    return row.n;
  }

  async countAllConversations(): Promise<number> {
    const [row] = await db.select({ n: count(conversations.id) }).from(conversations);
    return row.n;
  }

  async countConvertedConversations(): Promise<number> {
    const [row] = await db.select({ n: count(conversations.id) }).from(conversations).where(eq(conversations.converted, true));
    return row.n;
  }

  async getRecentConversations(limit: number): Promise<(Conversation & { personaName: string; lastMessage: string | null })[]> {
    const rows = await db
      .select({
        conversation: conversations,
        personaName: sql<string>`COALESCE(${personas.name}, 'Unknown Persona')`,
        lastMessage: sql<string | null>`(
          SELECT content FROM messages
          WHERE conversation_id = ${conversations.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
      })
      .from(conversations)
      .leftJoin(personas, eq(conversations.personaId, personas.id))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
    return rows.map(r => ({ ...r.conversation, personaName: r.personaName, lastMessage: r.lastMessage }));
  }

  async listAllPersonas(): Promise<Persona[]> {
    return db.select().from(personas).orderBy(asc(personas.difficulty), asc(personas.createdAt));
  }

  async listAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getPersonaStats(): Promise<Array<{ personaName: string; difficulty: number | null; totalSessions: number; prayerMoments: number }>> {
    const rows = await db
      .select({
        personaName: personas.name,
        difficulty: personas.difficulty,
        totalSessions: count(conversations.id),
        prayerMoments: sql<number>`count(case when ${conversations.converted} = true then 1 end)::int`,
      })
      .from(conversations)
      .innerJoin(personas, eq(conversations.personaId, personas.id))
      .groupBy(personas.name, personas.difficulty)
      .orderBy(personas.difficulty);
    return rows;
  }

  async getUserPeriodStats(): Promise<{ lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number }> {
    const now = new Date();
    const dayAgo   = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo  = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const [d, w, m, y, t] = await Promise.all([
      db.select({ n: count(users.id) }).from(users).where(gte(users.createdAt, dayAgo)),
      db.select({ n: count(users.id) }).from(users).where(gte(users.createdAt, weekAgo)),
      db.select({ n: count(users.id) }).from(users).where(gte(users.createdAt, monthAgo)),
      db.select({ n: count(users.id) }).from(users).where(gte(users.createdAt, yearAgo)),
      db.select({ n: count(users.id) }).from(users),
    ]);
    return { lastDay: d[0].n, lastWeek: w[0].n, lastMonth: m[0].n, lastYear: y[0].n, total: t[0].n };
  }

  async getConversationPeriodStats(): Promise<{ lastDay: number; lastWeek: number; lastMonth: number; lastYear: number; total: number }> {
    const now = new Date();
    const dayAgo   = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo  = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const [d, w, m, y, t] = await Promise.all([
      db.select({ n: count(conversations.id) }).from(conversations).where(gte(conversations.createdAt, dayAgo)),
      db.select({ n: count(conversations.id) }).from(conversations).where(gte(conversations.createdAt, weekAgo)),
      db.select({ n: count(conversations.id) }).from(conversations).where(gte(conversations.createdAt, monthAgo)),
      db.select({ n: count(conversations.id) }).from(conversations).where(gte(conversations.createdAt, yearAgo)),
      db.select({ n: count(conversations.id) }).from(conversations),
    ]);
    return { lastDay: d[0].n, lastWeek: w[0].n, lastMonth: m[0].n, lastYear: y[0].n, total: t[0].n };
  }

  async deleteAllConversations(): Promise<void> {
    await db.delete(messages);
    await db.delete(conversations);
  }
}

export const storage = new DatabaseStorage();
// Exporting authStorage for compatibility with auth integration
export const authStorage = storage;
