import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Run any pending schema migrations that drizzle-kit push would handle interactively
export async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT 'female';
    `);
    console.log("[db] Migration: gender column ready");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
  try {
    await pool.query(`
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS voice VARCHAR(20) NOT NULL DEFAULT 'Aria';
    `);
    console.log("[db] Migration: voice column ready");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
  try {
    await pool.query(`
      ALTER TABLE personas ADD COLUMN IF NOT EXISTS difficulty INTEGER NOT NULL DEFAULT 3;
    `);
    console.log("[db] Migration: difficulty column ready");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
  try {
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS converted BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log("[db] Migration: converted column ready");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
  try {
    // Fix "Hurt by the Church" difficulty: it should be level 4, not 3
    await pool.query(`
      UPDATE personas SET difficulty = 4 WHERE name = 'Hurt by the Church' AND difficulty = 3;
    `);
    console.log("[db] Migration: Hurt by the Church difficulty corrected to 4");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id),
        persona_id INTEGER NOT NULL REFERENCES personas(id),
        best_score INTEGER NOT NULL DEFAULT 0,
        passed BOOLEAN NOT NULL DEFAULT false,
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, persona_id)
      );
    `);
    console.log("[db] Migration: user_progress table ready");
  } catch (err: any) {
    console.error("[db] Migration warning (non-fatal):", err?.message);
  }
}
