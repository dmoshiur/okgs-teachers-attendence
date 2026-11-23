import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { admins } from "@/lib/schema";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { adminUpdateSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = adminUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const db = await ensureReady();
    const admin = await db.select().from(admins).where(eq(admins.id, session.adminId)).get();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const passwordMatches = await verifyPassword(parsed.data.currentPassword, admin.passwordHash);
    if (!passwordMatches) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const existing = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.username, parsed.data.username))
      .get();

    if (existing && existing.id !== admin.id) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(admins)
      .set({ username: parsed.data.username, passwordHash })
      .where(eq(admins.id, admin.id));

    return NextResponse.json({ ok: true, username: parsed.data.username });
  } catch (error) {
    console.error("[admin] update failed", error);
    return NextResponse.json({ error: "Could not update the admin account." }, { status: 500 });
  }
}
