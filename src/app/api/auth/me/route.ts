import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  }

  return NextResponse.json({
    username: auth.user.username,
    displayName: auth.user.displayName || auth.user.username,
    role: auth.user.role
  });
}
