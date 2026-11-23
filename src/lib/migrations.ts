import { sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";
import { admins } from "./schema";

type Database = LibSQLDatabase<typeof schema>;

/**
 * Schema migrations.
 *
 * The app has no build step on Vercel, so every migration must be applied at
 * runtime and must be **idempotent**: it can run on a brand new database, on a
 * database that already has some of the columns, and repeatedly on every cold
 * start. Each step checks the live schema (PRAGMA table_info) instead of
 * trusting a bookkeeping table, which also repairs a database that was
 * partially migrated by an older build.
 *
 * The same statements are mirrored in `migrations/0001_staff_and_users.sql` for
 * anyone who wants to apply them by hand with `turso db shell`.
 */

type ColumnDefinition = {
  table: "admins" | "teachers";
  column: string;
  definition: string;
};

/**
 * `NOT NULL DEFAULT …` keeps every existing row valid: current teachers become
 * `type = 'teacher'` and current admins become `role = 'admin'`, which the
 * backfill below then promotes to the first super admin.
 */
const COLUMNS: ColumnDefinition[] = [
  { table: "admins", column: "display_name", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "admins", column: "role", definition: "TEXT NOT NULL DEFAULT 'admin'" },
  { table: "admins", column: "is_active", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "admins", column: "created_at", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "teachers", column: "type", definition: "TEXT NOT NULL DEFAULT 'teacher'" },
  { table: "teachers", column: "designation", definition: "TEXT NOT NULL DEFAULT ''" }
];

async function existingColumns(db: Database, table: string): Promise<Set<string>> {
  const rows = (await db.all(sql.raw(`PRAGMA table_info(${table})`))) as Array<{
    name?: unknown;
  }>;
  return new Set(rows.map((row) => String(row.name ?? "")));
}

async function addMissingColumns(db: Database): Promise<string[]> {
  const added: string[] = [];
  const cache = new Map<string, Set<string>>();

  for (const entry of COLUMNS) {
    let columns = cache.get(entry.table);
    if (!columns) {
      columns = await existingColumns(db, entry.table);
      cache.set(entry.table, columns);
    }
    if (columns.has(entry.column)) continue;

    await db.run(
      sql.raw(`ALTER TABLE ${entry.table} ADD COLUMN ${entry.column} ${entry.definition}`)
    );
    columns.add(entry.column);
    added.push(`${entry.table}.${entry.column}`);
  }

  return added;
}

/** Existing rows get a real timestamp instead of 0 (1970-01-01). */
async function backfillAdminTimestamps(db: Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.run(
    sql.raw(
      `UPDATE admins SET created_at = ${now} WHERE created_at IS NULL OR created_at <= 0`
    )
  );
}

/**
 * Before the role column existed every account was a full administrator, so
 * the oldest one must keep working as the super admin. Otherwise a deployment
 * that adds `role` with a default of 'admin' would lock everyone out of
 * Settings and Users.
 */
async function ensureSuperAdminExists(db: Database): Promise<void> {
  const [row] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(sql.raw("role = 'super_admin' AND is_active = 1"))
    .limit(1);

  if (row) return;

  const [oldest] = await db
    .select({ id: admins.id })
    .from(admins)
    .orderBy(admins.id)
    .limit(1);

  if (!oldest) return;

  await db.run(
    sql.raw(
      `UPDATE admins SET role = 'super_admin', is_active = 1 WHERE id = ${Number(oldest.id)}`
    )
  );
  console.log(`[db] promoted admin #${oldest.id} to super_admin.`);
}

/**
 * Applies every pending migration and returns a short summary for the logs.
 * Safe to call on every boot.
 */
export async function runMigrations(db: Database): Promise<{ addedColumns: string[] }> {
  const addedColumns = await addMissingColumns(db);
  await backfillAdminTimestamps(db);
  await ensureSuperAdminExists(db);
  if (addedColumns.length > 0) {
    console.log(`[db] migrated: ${addedColumns.join(", ")}`);
  }
  return { addedColumns };
}

/** The SQL a DBA can run by hand. Kept in sync with the steps above. */
export const MANUAL_MIGRATION_SQL: SQL[] = [
  sql.raw(`ALTER TABLE admins ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`),
  sql.raw(`ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'`),
  sql.raw(`ALTER TABLE admins ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`),
  sql.raw(`ALTER TABLE admins ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`),
  sql.raw(`ALTER TABLE teachers ADD COLUMN type TEXT NOT NULL DEFAULT 'teacher'`),
  sql.raw(`ALTER TABLE teachers ADD COLUMN designation TEXT NOT NULL DEFAULT ''`)
];
