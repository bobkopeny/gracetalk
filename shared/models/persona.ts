import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
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
  difficulty: integer("difficulty").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  voice: z.string().default("Aria"),
  difficulty: z.number().int().min(1).max(5).default(3),
});

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

// All available xAI Grok realtime voices
export const XAI_VOICES = [
  { id: "Aria",   label: "Aria",   gender: "female" },
  { id: "Eve",    label: "Eve",    gender: "female" },
  { id: "Cove",   label: "Cove",   gender: "female" },
  { id: "Sal",    label: "Sal",    gender: "female" },
  { id: "Aurora", label: "Aurora", gender: "female" },
  { id: "Leo",    label: "Leo",    gender: "male"   },
  { id: "Rex",    label: "Rex",    gender: "male"   },
  { id: "Orion",  label: "Orion",  gender: "male"   },
  { id: "Vale",   label: "Vale",   gender: "male"   },
] as const;

export type XaiVoice = typeof XAI_VOICES[number]["id"];

// Difficulty levels — controls how many compelling responses are needed for conversion
export const DIFFICULTY_CONFIG = {
  1: { label: "Easy",       stars: 1, threshold: 2, tagColor: "bg-green-100 text-green-700",  description: "Open and seeking" },
  2: { label: "Moderate",   stars: 2, threshold: 3, tagColor: "bg-blue-100 text-blue-700",    description: "Politely skeptical" },
  3: { label: "Challenging",stars: 3, threshold: 4, tagColor: "bg-yellow-100 text-yellow-700",description: "Resistant" },
  4: { label: "Hard",       stars: 4, threshold: 5, tagColor: "bg-orange-100 text-orange-700",description: "Firmly opposed" },
  5: { label: "Expert",     stars: 5, threshold: 7, tagColor: "bg-red-100 text-red-700",      description: "Deeply hardened" },
} as const;

export type Difficulty = keyof typeof DIFFICULTY_CONFIG;

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
