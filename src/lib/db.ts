import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { admins } from "./schema";
import { hashPassword } from "./auth";
import { runMigrations } from "./migrations";

type Database = LibSQLDatabase<typeof schema>;

type GlobalDb = {
  client?: Client;
  db?: Database;
  ready?: Promise<Database>;
};

const globalDb = globalThis as unknown as GlobalDb;

function getDatabase(): Database {
  if (globalDb.db) return globalDb.db;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Add it to your environment variables (see README)."
    );
  }

  if (!globalDb.client) {
    globalDb.client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined
    });
  }

  globalDb.db = drizzle(globalDb.client, { schema });
  return globalDb.db;
}

/**
 * Fresh-database schema. Columns added later are also listed here so a new
 * install matches a migrated one; `runMigrations` adds any that are missing
 * from a pre-existing table.
 */
const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT admins_username_unique UNIQUE (username)
  )`,
  `CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    type TEXT NOT NULL DEFAULT 'teacher',
    designation TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS assets (
    key TEXT PRIMARY KEY NOT NULL,
    mime TEXT NOT NULL,
    data BLOB NOT NULL
  )`
];

async function ensureSchema(db: Database) {
  for (const statement of CREATE_TABLES) {
    await db.run(sql.raw(statement));
  }
  await runMigrations(db);
}

async function countAdmins(db: Database): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(admins);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Seeds exactly one account on a fresh database. Safe to call on every boot:
 * it only inserts when the table is empty and never updates or recreates an
 * existing user, so changing ADMIN_PASSWORD later has no effect on a live
 * account.
 */
async function seedAdmin(db: Database) {
  if ((await countAdmins(db)) > 0) return;

  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      "[db] admins table is empty but ADMIN_USERNAME / ADMIN_PASSWORD are not set. " +
        "Set them to create the first admin account."
    );
    return;
  }

  const passwordHash = await hashPassword(password);

  // A concurrent cold start may insert the same username first. The unique
  // constraint plus ON CONFLICT DO NOTHING keeps this idempotent.
  await db
    .insert(admins)
    .values({
      username,
      passwordHash,
      displayName: username,
      role: "super_admin",
      isActive: true,
      createdAt: Math.floor(Date.now() / 1000)
    })
    .onConflictDoNothing({ target: admins.username });

  if ((await countAdmins(db)) === 0) {
    throw new Error("Failed to seed the initial admin account.");
  }

  console.log(`[db] seeded initial super admin account "${username}".`);
}

export function ensureReady(): Promise<Database> {
  if (!globalDb.ready) {
    globalDb.ready = (async () => {
      const db = getDatabase();
      await ensureSchema(db);
      await seedAdmin(db);
      return db;
    })().catch((error) => {
      // Allow the next request to retry instead of caching a failed startup.
      globalDb.ready = undefined;
      throw error;
    });
  }
  return globalDb.ready;
}
