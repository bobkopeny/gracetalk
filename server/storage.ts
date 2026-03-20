import { users, personas, conversations, messages, feedbacks } from "@shared/schema";
import type { User, UpsertUser, Persona, InsertPersona, Conversation, Message, Feedback } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Personas
  createPersona(persona: InsertPersona): Promise<Persona>;
  getPersona(id: number): Promise<Persona | undefined>;
  listPersonas(userId: string): Promise<Persona[]>;
  deletePersona(id: number): Promise<void>;

  // Chat
  createConversation(userId: string, personaId: number, title: string): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  listConversations(userId: string): Promise<(Conversation & { personaName: string })[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<Message>;
  getMessages(conversationId: number): Promise<Message[]>;

  // Feedback
  createFeedback(conversationId: number, content: string): Promise<Feedback>;
  getFeedback(conversationId: number): Promise<Feedback | undefined>;
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

  async deletePersona(id: number): Promise<void> {
    await db.delete(personas).where(eq(personas.id, id));
  }

  async createConversation(userId: string, personaId: number, title: string): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values({ userId, personaId, title }).returning();
    return conversation;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async listConversations(userId: string): Promise<(Conversation & { personaName: string })[]> {
    const rows = await db
      .select({
        conversation: conversations,
        personaName: personas.name,
      })
      .from(conversations)
      .innerJoin(personas, eq(conversations.personaId, personas.id))
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));
    
    return rows.map(row => ({
      ...row.conversation,
      personaName: row.personaName,
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
}

export const storage = new DatabaseStorage();
// Exporting authStorage for compatibility with auth integration
export const authStorage = storage;
