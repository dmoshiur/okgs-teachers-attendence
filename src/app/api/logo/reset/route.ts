import { NextResponse } from "next/server";
import { resetLogo } from "@/lib/logo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await resetLogo();
    return NextResponse.json({ ok: true, version: result.version, mime: result.mime });
  } catch (error) {
    console.error("[logo] reset failed", error);
    return NextResponse.json({ error: "Could not reset the logo." }, { status: 500 });
  }
}
