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
  await pool.query(`
    ALTER TABLE personas ADD COLUMN IF NOT EXISTS gender VARCHAR(10) NOT NULL DEFAULT 'female';
  `);
}
