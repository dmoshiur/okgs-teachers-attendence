import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { admins } from "@/lib/schema";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await ensureReady();
  const admin = await db
    .select({ username: admins.username })
    .from(admins)
    .where(eq(admins.id, session.adminId))
    .get();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ username: admin.username });
}
