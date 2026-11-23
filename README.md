# Teacher Attendance Sheet Generator

A production-ready Next.js (App Router) app for schools that generates print-ready
teacher attendance sheets in **PDF** and **DOCX** for any month — with a live preview,
staff management, user accounts, and branding settings.

![Stack](https://img.shields.io/badge/Next.js%2015-App%20Router-black) ![DB](https://img.shields.io/badge/Turso-libSQL-blue) ![PDF](https://img.shields.io/badge/PDF-@react--pdf-red) ![DOCX](https://img.shields.io/badge/DOCX-docx-2b579a)

---

## Features

| Area | What it does |
| --- | --- |
| **Generator (`/`)** | Month + year pickers, an **Include** selector (All / Teachers only / Staff only), live PDF preview, **Download PDF**, **Download DOCX**, **Print** |
| **Staff & Teachers (`/teachers`)** | Single add, **bulk add** from pasted lines, type badge, filter + search, inline edit, delete with confirm, reorder with up/down arrows — English and Bangla names |
| **Users (`/users`)** | Super admins create accounts, set roles, reset passwords, deactivate and delete users |
| **Settings (`/settings`)** | School name, sheet-title template, logo upload/reset, print options |
| **My account (`/account`)** | Every user edits their own display name and password |
| **Auth** | `httpOnly` JWT session cookie (user id only), bcrypt passwords, database-backed guards |

### Roles

| | Super admin | Admin |
| --- | --- | --- |
| Generate, download, print sheets | ✅ | ✅ |
| Manage Staff & Teachers | ✅ | ✅ |
| Open **Users** | ✅ | ❌ |
| Open **Settings** (name, logo, title template) | ✅ | ❌ |
| My account | ✅ | ✅ |

Permissions are enforced in **every page, layout and API route** through one shared guard,
`requireUser()` in `src/lib/auth.ts`. It loads the account from the database by the id in
the cookie and uses the **database values** for `role` and `is_active`; the session cookie
never carries a role. That has two consequences worth knowing:

- a session issued before roles existed keeps working — nothing in the token depends on
  the old schema, so nobody has to sign out and back in after an upgrade;
- changing a role or deactivating an account takes effect on the user's next request.

Middleware (Edge runtime, no database access) only checks that a signed session exists and
never decides anything from a role. A plain admin who opens `/users` or `/settings` by URL
sees a **"You do not have permission"** page with a back button instead of being silently
redirected home. A deactivated or deleted account is refused, its cookie is cleared, and the
next navigation lands on `/login`.

Every refusal is logged server-side as
`[auth] access denied: user=<id> role=<role> reason=<reason>`, so a lockout can be read
straight from the Vercel function logs. You cannot delete or deactivate yourself, and the
last active super admin cannot be deleted, demoted or deactivated.

### Sheet layout

Every page is A4 portrait with a **triple-line black page border** whose outer line sits
**0.5 in (1.27 cm) from every paper edge**, so it prints fully on any A4 printer. The
heading (logo in full colour, school name in bold 23 pt, title in 15 pt) and the table stay
inside the border with at least 0.3 cm of clear space on all sides.

Each page holds **one table with three people and ten columns** (Date · Sign In · Signature ·
Sign Out × 3). Day rows are numbered 1–31, 0.65 cm tall, with zebra shading on even days —
all 31 days plus the two header rows fit on a single page with no overflow. Column widths
keep the reference proportions (scaled from 9952 to 9745 twips so the table fits inside the
border). A person's designation is printed under their name only when **Settings → Show
designation under name** is on.

Fonts: **Tinos** (Times New Roman metric-compatible) and **Noto Serif Bengali** are
bundled and **embedded** in both the PDF and the DOCX, so Bangla names render correctly
on any machine.

---

## Requirements

- Node.js **20+**
- A [Turso](https://turso.tech) database (libSQL)

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | ✅ | `libsql://…` (or `file:./local.db` for local development) |
| `TURSO_AUTH_TOKEN` | Turso only | Database auth token (empty for a local file) |
| `ADMIN_USERNAME` | first run only | Username seeded into the empty `admins` table |
| `ADMIN_PASSWORD` | first run only | Password seeded into the empty `admins` table |
| `SESSION_SECRET` | ✅ | Long random string used to sign the session JWT |
| `SCHOOL_NAME` | optional | Default school name before it is changed in Settings |

> **Seeding is idempotent.** The first account is only created when the `admins` table is
> empty, and it is created as a **super admin**. Changing `ADMIN_PASSWORD` later **never**
> overwrites or recreates an existing user. Use **My account** to change a password.

Generate a session secret with:

```bash
openssl rand -base64 32
```

## Local development

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run dev
```

Open <http://localhost:3000> and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

Tables and migrations are applied automatically on the first request
(`src/lib/db.ts` → `src/lib/migrations.ts`). You can also push the Drizzle schema
explicitly:

```bash
npm run db:push
```

> For a local file database the server creates `local.db` in the project root. It is
> git-ignored.

## Deploying to Vercel

1. **Create the database**
   ```bash
   turso db create teachers-attendance
   turso db tokens create teachers-attendance
   turso db show-url teachers-attendance
   ```
2. **Push the project** to GitHub and import it in Vercel.
3. **Add the environment variables** (Project → Settings → Environment Variables):
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
   `SESSION_SECRET`.
4. **Deploy.** No build command or output directory changes are needed.

The app runs as Vercel serverless functions — there is no headless Chrome, no local
filesystem storage, and no long-running server. Logos live in the database as WebP;
fonts and the default logo are bundled into the function trace.

> Existing sessions keep working after this update: the cookie contains only the
> user id, so a session issued by an older build (which stored the role in the
> token) is still accepted and the role is read fresh from the database.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (type-checks and lints) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push the Drizzle schema to the database |

## Project structure

```
src/
├── app/
│   ├── (app)/                   # Route group: layout requires a signed-in user
│   │   ├── page.tsx             # Generator
│   │   ├── teachers/page.tsx    # Staff & Teachers
│   │   ├── users/page.tsx       # User management (super admin, or a permission page)
│   │   ├── settings/page.tsx    # Settings (super admin, or a permission page)
│   │   └── account/page.tsx     # My account
│   ├── login/page.tsx           # Sign in
│   └── api/                     # auth, teachers, users, account, settings, logo, generate
├── components/                  # Shell, forms, toast, UI primitives
├── lib/
│   ├── db.ts                    # libSQL client + schema bootstrap + super admin seed
│   ├── migrations.ts            # Idempotent column migrations
│   ├── schema.ts                # Drizzle schema
│   ├── auth.ts                  # bcrypt + jose session (user id only) + requireUser()
│   ├── users.ts                 # User management and its safety rules
│   ├── sheet.ts                 # Sheet model, geometry, Bangla run splitting
│   ├── pdf.tsx                  # @react-pdf document
│   ├── docx.ts                  # docx document (fonts embedded)
│   ├── logo.ts                  # sharp → WebP storage
│   ├── settings.ts / teachers.ts / validation.ts
├── assets/fonts/                # Tinos + Noto Serif Bengali (embedded)
└── middleware.ts                # Session check only (Edge runtime, no DB)
```

## Database schema

```sql
admins   (id, username UNIQUE, password_hash, display_name, role, is_active, created_at)
teachers (id, name, sort_order, is_active, type, designation)
settings (key PRIMARY KEY, value)
assets   (key PRIMARY KEY, mime, data BLOB)
```

`admins.role` is `super_admin` or `admin`. `teachers.type` is `teacher` or `staff`.

The database ships empty apart from the single seeded super admin — no sample staff.

## Migrations

Schema changes are applied **at runtime, on every boot**, by
`src/lib/migrations.ts`. Each step checks the live schema with
`PRAGMA table_info` before adding a column, so it is safe to run repeatedly, on a
fresh database, and on one that was only partly migrated. Nothing is dropped and no row
is rewritten: new columns arrive with defaults that keep existing data valid.

- `teachers.type` defaults to `'teacher'` — existing people stay teachers.
- `admins.role` is repaired for any row whose role is missing, empty or unknown:
  the account named by `ADMIN_USERNAME` becomes `super_admin`, otherwise the
  **oldest account** does (before roles existed it was the only account, hence
  the full administrator); every other account becomes a plain `admin`.
- `admins.is_active` defaults to `1`, `display_name` to `''`, and `created_at`
  gets a real timestamp instead of `0`.
- A final safety net guarantees **at least one active super admin**: if none
  exists, the account named by `ADMIN_USERNAME` (or, failing that, the oldest
  account) is promoted. This is what unlocks Settings and Users if a database
  was created before roles existed or was migrated by hand.

The equivalent SQL is in `migrations/0001_staff_and_users.sql` for anyone who wants to
apply it by hand:

```bash
turso db shell <database-name> < migrations/0001_staff_and_users.sql
```

SQLite has no `ADD COLUMN IF NOT EXISTS`, so a "duplicate column name" error simply
means that column is already there.

## Troubleshooting

**Users or Settings sends me to the home page / says I have no permission.** Both pages
are super-admin only. Check the account's role in the database (`select id, username,
role, is_active from admins;`) — it must be `super_admin` and `is_active = 1`. The
migration repairs a missing or empty role on startup: the account named by
`ADMIN_USERNAME` (or the oldest account) is promoted when no active super admin exists.
Every refusal is logged as `[auth] access denied: user=<id> role=<role> reason=<reason>`,
so the cause is visible in the Vercel function logs. A plain admin gets a permission page
by design; only a super admin can open those pages.

**PDF returns "Could not generate the PDF." on Vercel.** The route logs the real error to the
function logs. The usual cause is a file that the serverless file tracer cannot see: the PDF
and DOCX functions read the bundled `.ttf` fonts and the default logo with `fs`, and
`@react-pdf/renderer` (which is externalised) loads `pdfkit`'s standard-font modules through
a computed `require()`. All of these are declared in `outputFileTracingIncludes` in
`next.config.ts` — if you move the fonts or rename the routes, update that list.

To check what a function will actually ship, inspect the generated trace after `next build`:

```bash
node -e "console.log(require('./.next/server/app/api/generate/pdf/route.js.nft.json').files.filter(f => /ttf|pdfkit|logo\\.png/.test(f)))"
```

## Printing

The preview **is** the generated PDF. Press **Print** and, in the browser dialog, set:

> Paper: **A4**, Scale: **100% (Actual size)**, Margins: **None/Default**, and turn off
> **Headers and footers**.

The page already carries its own border and header, so no browser chrome should be added.
The border sits 1.27 cm inside the paper edge, which is inside the printable area of a
standard A4 printer — nothing is clipped at 100% scale.

For the DOCX, Word shows the same border: the page margin is 1.9 cm and the border is
drawn 0.63 cm outside it.
