-- 0001_staff_and_users.sql
--
-- Staff & Teachers entry + user management.
--
-- The app applies these statements automatically on startup (see
-- src/lib/migrations.ts) and skips any column that already exists, so you do
-- NOT need to run this file on Vercel. It is provided for anyone who wants to
-- apply the change by hand against Turso:
--
--     turso db shell <database-name> < migrations/0001_staff_and_users.sql
--
-- SQLite has no `ADD COLUMN IF NOT EXISTS`. If a statement fails with
-- "duplicate column name", that column is already there and the migration has
-- already run — the app tolerates both states. Every statement is additive:
-- no table is dropped, no row is rewritten, and existing rows get the defaults
-- below.

-- Existing people keep working as teachers.
ALTER TABLE teachers ADD COLUMN type TEXT NOT NULL DEFAULT 'teacher';
ALTER TABLE teachers ADD COLUMN designation TEXT NOT NULL DEFAULT '';

-- Existing accounts keep working as administrators. The app then repairs the
-- role so nobody is locked out of Settings and Users (see the backfill below).
ALTER TABLE admins ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admins ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;

-- Backfill, applied automatically by the app. Only rows with a missing or
-- unknown role are touched:
--   * the account whose username matches ADMIN_USERNAME becomes super_admin;
--   * otherwise the oldest account becomes super_admin (before roles existed it
--     was the only account, hence the full administrator);
--   * every other account becomes a plain admin.
--
-- Replace ADMIN_USERNAME below with the seeded account's username.
UPDATE admins
SET role = CASE
    WHEN lower(username) = lower('ADMIN_USERNAME') THEN 'super_admin'
    WHEN id = (SELECT MIN(id) FROM admins) THEN 'super_admin'
    ELSE 'admin'
  END
WHERE role IS NULL OR trim(role) = '' OR role NOT IN ('super_admin', 'admin');

UPDATE admins SET is_active = 1 WHERE is_active IS NULL;
UPDATE admins SET display_name = '' WHERE display_name IS NULL;
UPDATE admins SET created_at = strftime('%s', 'now') WHERE created_at IS NULL OR created_at <= 0;

-- Safety net, also applied automatically: if no *active* super admin exists
-- after the steps above, promote the account named by ADMIN_USERNAME (or the
-- oldest account) so the installation always has one.
-- UPDATE admins
-- SET role = 'super_admin', is_active = 1
-- WHERE id = (
--   SELECT id FROM admins WHERE lower(username) = lower('ADMIN_USERNAME')
--   UNION SELECT id FROM admins ORDER BY id LIMIT 1
--   LIMIT 1
-- );
