import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { admins } from "@/lib/schema";
import { createSessionToken, setSessionCookie, verifyPassword } from "@/lib/auth";
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
    const admin = await db
      .select()
      .from(admins)
      .where(eq(admins.username, parsed.data.username))
      .get();

    if (!admin) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(parsed.data.password, admin.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await createSessionToken({ adminId: admin.id, username: admin.username });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, username: admin.username });
  } catch (error) {
    console.error("[auth] login failed", error);
    return NextResponse.json({ error: "Login failed. Please try again." }, { status: 500 });
  }
}
