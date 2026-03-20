import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

export const personas = pgTable("personas", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(), // Background, beliefs, resistance points
  gender: varchar("gender", { length: 10 }).notNull().default("female"),
  voice: varchar("voice", { length: 20 }).notNull().default("Aria"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  voice: z.string().default("Aria"),
});

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

// All available xAI Grok realtime voices
export const XAI_VOICES = [
  { id: "Aria", label: "Aria", gender: "female" },
  { id: "Eve",  label: "Eve",  gender: "female" },
  { id: "Sal",  label: "Sal",  gender: "female" },
  { id: "Leo",  label: "Leo",  gender: "male"   },
  { id: "Rex",  label: "Rex",  gender: "male"   },
] as const;

export type XaiVoice = typeof XAI_VOICES[number]["id"];

// Fallback: map gender to default voice (used when no explicit voice is set)
export function genderToVoice(gender: string): string {
  return gender === "male" ? "Rex" : "Aria";
}

// Simple heuristic: detect gender from a name string
const FEMALE_NAMES = new Set([
  "mary","maria","mary","sarah","sara","jessica","jennifer","amanda","ashley","emily",
  "emma","olivia","ava","isabella","sophia","mia","charlotte","amelia","harper","evelyn",
  "abigail","elizabeth","sofia","ella","madison","scarlett","victoria","grace","chloe",
  "camila","penelope","riley","layla","lillian","nora","zoey","mila","aubrey","hannah",
  "lily","addison","eleanor","natalie","luna","savannah","brooklyn","leah","zoe","stella",
  "hazel","ellie","paisley","audrey","skylar","violet","claire","belinda","aurora",
  "anna","samantha","alice","andrea","angela","brenda","carol","caroline","catherine",
  "diana","donna","dorothy","helen","katherine","laura","linda","lisa","margaret",
  "michelle","patricia","rachel","rebecca","sandra","sharon","stephanie","susan","teresa",
  "deborah","karen","nancy","betty","ruth","virginia","judy","joan","diana","cheryl",
  "eve","ara","aura","faith","hope","grace","joy","rue",
]);

const MALE_TITLES = ["mr","sir","uncle","brother","bro","pastor","reverend","father","deacon","elder"];
const FEMALE_TITLES = ["ms","mrs","miss","aunt","sister","sis","mother","mom"];

export function detectGenderFromName(name: string): "female" | "male" {
  const lower = name.toLowerCase();
  const words = lower.split(/[\s,]+/);

  for (const w of words) {
    if (MALE_TITLES.includes(w)) return "male";
    if (FEMALE_TITLES.includes(w)) return "female";
  }
  for (const w of words) {
    if (FEMALE_NAMES.has(w)) return "female";
  }
  // Default to female if no signal found
  return "female";
}
