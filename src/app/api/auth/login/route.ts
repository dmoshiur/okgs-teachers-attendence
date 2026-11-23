import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { admins } from "@/lib/schema";
import {
  createSessionToken,
  setSessionCookie,
  verifyPassword
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const db = await ensureReady();
    // Usernames are unique ignoring case, so the lookup must be too.
    const admin = await db
      .select()
      .from(admins)
      .where(sql`lower(${admins.username}) = ${parsed.data.username.trim().toLowerCase()}`)
      .get();

    if (!admin) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(parsed.data.password, admin.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    // A deactivated account may hold a valid password; it still cannot sign in.
    if (!admin.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Ask a super admin to restore it." },
        { status: 403 }
      );
    }

    // The cookie carries only the account id; the role is read from the database
    // on every request (see requireUser in src/lib/auth.ts).
    const token = await createSessionToken(admin.id);
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      username: admin.username,
      displayName: admin.displayName || admin.username,
      role: admin.role
    });
  } catch (error) {
    console.error("[auth] login failed", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
