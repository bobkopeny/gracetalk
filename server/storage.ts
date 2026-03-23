import { users, personas, conversations, messages, feedbacks, userProgress } from "@shared/schema";
import type { User, UpsertUser, Persona, InsertPersona, Conversation, Message, Feedback, UserProgress } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Personas
  createPersona(persona: InsertPersona): Promise<Persona>;
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

  // Feedback
  createFeedback(conversationId: number, content: string): Promise<Feedback>;
  getFeedback(conversationId: number): Promise<Feedback | undefined>;

  // Progress
  upsertUserProgress(userId: string, personaId: number, score: number): Promise<void>;
  getUserProgress(userId: string): Promise<UserProgress[]>;

  // Admin
  countAllUsers(): Promise<number>;
  countAllConversations(): Promise<number>;
  getRecentConversations(limit: number): Promise<(Conversation & { personaName: string })[]>;
  listAllPersonas(): Promise<Persona[]>;
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

  async createPersona(persona: InsertPersona): Promise<Persona> {
    const [newPersona] = await db.insert(personas).values(persona).returning();
    return newPersona;
  }

  async getPersona(id: number): Promise<Persona | undefined> {
    const [persona] = await db.select().from(personas).where(eq(personas.id, id));
    return persona;
  }

  async listPersonas(userId: string): Promise<Persona[]> {
    return db.select().from(personas).where(eq(personas.userId, userId)).orderBy(desc(personas.createdAt));
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
        difficulty: 3,
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
        personaName: personas.name,
        messageCount: count(messages.id),
        lastMessage: sql<string | null>`(
          SELECT content FROM messages
          WHERE conversation_id = ${conversations.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`,
      })
      .from(conversations)
      .innerJoin(personas, eq(conversations.personaId, personas.id))
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

  async createFeedback(conversationId: number, content: string): Promise<Feedback> {
    const [feedback] = await db.insert(feedbacks).values({ conversationId, content }).returning();
    return feedback;
  }

  async getFeedback(conversationId: number): Promise<Feedback | undefined> {
    const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.conversationId, conversationId));
    return feedback;
  }

  async upsertUserProgress(userId: string, personaId: number, score: number): Promise<void> {
    await db
      .insert(userProgress)
      .values({ userId, personaId, bestScore: score, passed: score >= 60, attempts: 1 })
      .onConflictDoUpdate({
        target: [userProgress.userId, userProgress.personaId],
        set: {
          bestScore: sql`GREATEST(user_progress.best_score, ${score})`,
          passed: sql`user_progress.passed OR ${score >= 60}`,
          attempts: sql`user_progress.attempts + 1`,
          updatedAt: new Date(),
        },
      });
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return db.select().from(userProgress).where(eq(userProgress.userId, userId));
  }

  async countAllUsers(): Promise<number> {
    const [row] = await db.select({ n: count(users.id) }).from(users);
    return row.n;
  }

  async countAllConversations(): Promise<number> {
    const [row] = await db.select({ n: count(conversations.id) }).from(conversations);
    return row.n;
  }

  async getRecentConversations(limit: number): Promise<(Conversation & { personaName: string })[]> {
    const rows = await db
      .select({ conversation: conversations, personaName: personas.name })
      .from(conversations)
      .innerJoin(personas, eq(conversations.personaId, personas.id))
      .orderBy(desc(conversations.createdAt))
      .limit(limit);
    return rows.map(r => ({ ...r.conversation, personaName: r.personaName }));
  }

  async listAllPersonas(): Promise<Persona[]> {
    return db.select().from(personas).orderBy(desc(personas.createdAt));
  }
}

export const storage = new DatabaseStorage();
// Exporting authStorage for compatibility with auth integration
export const authStorage = storage;
