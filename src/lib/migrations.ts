import { asc, eq, sql, type SQL } from "drizzle-orm";
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
 * Nothing here deletes a row or drops a column. New columns arrive with defaults
 * that keep existing data valid, and the backfill below only fills in values
 * that are missing.
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
 * backfill below then repairs.
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
async function backfillAdminDefaults(db: Database): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.run(sql.raw(`UPDATE admins SET display_name = '' WHERE display_name IS NULL`));
  await db.run(
    sql.raw(`UPDATE admins SET created_at = ${now} WHERE created_at IS NULL OR created_at <= 0`)
  );
  // A column added by hand without the default leaves NULLs; treat them as active.
  await db.run(sql.raw(`UPDATE admins SET is_active = 1 WHERE is_active IS NULL`));
}

/**
 * Repairs rows that have no usable role, which is what an admin row looks like
 * after `ALTER TABLE admins ADD COLUMN role TEXT` (nullable, no default) or after
 * a partially applied migration.
 *
 * Rules:
 *  - the account whose username equals ADMIN_USERNAME becomes `super_admin`;
 *  - otherwise the oldest account becomes `super_admin`, because before roles
 *    existed it was the only account and therefore the full administrator;
 *  - every other account becomes a plain `admin`.
 */
async function backfillAdminRoles(db: Database): Promise<number> {
  const envUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase() || null;
  const envMatch = envUsername
    ? sql`lower(${admins.username}) = ${envUsername}`
    : sql`0 = 1`;

  const result = await db.run(
    sql`
      UPDATE admins
      SET role = CASE
        WHEN ${envMatch} THEN 'super_admin'
        WHEN ${admins.id} = (SELECT MIN(id) FROM admins) THEN 'super_admin'
        ELSE 'admin'
      END
      WHERE ${admins.role} IS NULL
        OR trim(${admins.role}) = ''
        OR ${admins.role} NOT IN ('super_admin', 'admin')
    `
  );

  const repaired = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
  if (repaired > 0) {
    console.log(`[db] backfilled role for ${repaired} admin(s).`);
  }
  return repaired;
}

/**
 * Guarantees the installation always has someone who can reach Users and
 * Settings: if no active super admin exists, the account named by
 * ADMIN_USERNAME (or, failing that, the oldest account) is promoted.
 */
async function ensureSuperAdminExists(db: Database): Promise<void> {
  const [existing] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(sql`${admins.role} = 'super_admin' AND ${admins.isActive} = 1`)
    .limit(1);

  if (existing) return;

  const envUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase() || null;
  let target: { id: number } | undefined;

  if (envUsername) {
    [target] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(sql`lower(${admins.username}) = ${envUsername}`)
      .limit(1);
  }

  if (!target) {
    [target] = await db.select({ id: admins.id }).from(admins).orderBy(asc(admins.id)).limit(1);
  }

  if (!target) return;

  await db
    .update(admins)
    .set({ role: "super_admin", isActive: true })
    .where(eq(admins.id, target.id));
  console.log(`[db] promoted admin #${target.id} to super_admin.`);
}

/**
 * Applies every pending migration and returns a short summary for the logs.
 * Safe to call on every boot.
 */
export async function runMigrations(db: Database): Promise<{ addedColumns: string[] }> {
  const addedColumns = await addMissingColumns(db);
  await backfillAdminDefaults(db);
  await backfillAdminRoles(db);
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
  sql.raw(`ALTER TABLE teachers ADD COLUMN designation TEXT NOT NULL DEFAULT ''`),
  // Backfill: replace ADMIN_USERNAME below with the seeded account's username.
  sql.raw(
    `UPDATE admins SET role = CASE
        WHEN lower(username) = lower('ADMIN_USERNAME') THEN 'super_admin'
        WHEN id = (SELECT MIN(id) FROM admins) THEN 'super_admin'
        ELSE 'admin'
      END
      WHERE role IS NULL OR trim(role) = '' OR role NOT IN ('super_admin', 'admin')`
  ),
  sql.raw(`UPDATE admins SET is_active = 1 WHERE is_active IS NULL`)
];
