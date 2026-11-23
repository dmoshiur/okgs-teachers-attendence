# Teacher Attendance Sheet Generator

A production-ready Next.js (App Router) app for schools that generates print-ready
teacher attendance sheets in **PDF** and **DOCX** for any month — with a live preview,
teacher management, and branding settings.

![Stack](https://img.shields.io/badge/Next.js%2015-App%20Router-black) ![DB](https://img.shields.io/badge/Turso-libSQL-blue) ![PDF](https://img.shields.io/badge/PDF-@react--pdf-red) ![DOCX](https://img.shields.io/badge/DOCX-docx-2b579a)

---

## Features

| Area | What it does |
| --- | --- |
| **Generator (`/`)** | Month + year pickers, live PDF preview, **Download PDF**, **Download DOCX**, **Print** |
| **Teachers (`/teachers`)** | Add, rename inline, delete (with confirm), reorder with up/down arrows — English and Bangla names |
| **Settings (`/settings`)** | School name, sheet-title template, logo upload/reset, print toggles, admin account change |
| **Auth** | Single admin account, `httpOnly` JWT session cookie, middleware-protected app |

### Sheet layout

Every page is A4 portrait with a **triple-line black page border** (1.5 pt, 6 pt from the
page edge), the school logo in full colour at the top-left, the school name in bold
23 pt and the title line in 15 pt, followed by **one table per page with three teachers
and ten columns** (Date · Sign In · Signature · Sign Out × 3). Day rows are numbered
1–31, empty, ~0.8 cm tall, with zebra shading on even days. The exact column widths
(twips, summing to 9952) match the reference document.

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

> **Seeding is idempotent.** The first admin is only created when the `admins` table is
> empty — changing `ADMIN_PASSWORD` later **never** overwrites an existing account.
> Use **Settings → Admin account** to change it.

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

Tables are created automatically on the first request (`src/lib/db.ts`). You can also
push the Drizzle schema explicitly:

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
│   ├── page.tsx                 # Generator
│   ├── login/page.tsx           # Sign in
│   ├── teachers/page.tsx        # Teacher management
│   ├── settings/page.tsx        # Settings
│   └── api/                     # auth, teachers, settings, admin, logo, generate
├── components/                  # Shell, forms, toast, UI primitives
├── lib/
│   ├── db.ts                    # libSQL client + schema bootstrap + admin seed
│   ├── schema.ts                # Drizzle schema
│   ├── auth.ts                  # bcrypt + jose session JWT
│   ├── sheet.ts                 # Sheet model, geometry, Bangla run splitting
│   ├── pdf.tsx                  # @react-pdf document
│   ├── docx.ts                  # docx document (fonts embedded)
│   ├── logo.ts                  # sharp → WebP storage
│   ├── settings.ts / teachers.ts / validation.ts
├── assets/fonts/                # Tinos + Noto Serif Bengali (embedded)
└── middleware.ts                # Route protection
```

## Printing

The preview **is** the generated PDF. Press **Print** and, in the browser dialog, set:

> Paper: **A4**, Scale: **100% (Actual size)**, Margins: **None/Default**, and turn off
> **Headers and footers**.

The page already carries its own border and header, so no browser chrome should be added.

## Database schema

```sql
admins   (id, username UNIQUE, password_hash)
teachers (id, name, sort_order, is_active)
settings (key PRIMARY KEY, value)
assets   (key PRIMARY KEY, mime, data BLOB)
```

The database ships empty apart from the single seeded admin — no sample teachers.
