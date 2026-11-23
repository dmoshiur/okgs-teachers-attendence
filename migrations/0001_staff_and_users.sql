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

-- Existing accounts keep working as administrators. The app then promotes the
-- oldest account to super_admin so nobody is locked out of Settings and Users.
ALTER TABLE admins ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE admins ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admins ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;

-- Optional, and only if the app has not started yet: give existing accounts a
-- real timestamp instead of 0, and make the first account the super admin.
-- UPDATE admins SET created_at = strftime('%s', 'now') WHERE created_at <= 0;
-- UPDATE admins SET role = 'super_admin' WHERE id = (SELECT MIN(id) FROM admins);
