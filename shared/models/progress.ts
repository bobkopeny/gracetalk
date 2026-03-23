import { pgTable, serial, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./auth";
import { personas } from "./persona";

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  personaId: integer("persona_id").references(() => personas.id).notNull(),
  bestScore: integer("best_score").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type UserProgress = typeof userProgress.$inferSelect;
