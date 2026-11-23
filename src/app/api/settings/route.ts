import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { getLogoVersion } from "@/lib/logo";
import { settingsSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [settings, logoVersion] = await Promise.all([getSettings(), getLogoVersion()]);
    return NextResponse.json({ settings, logoVersion });
  } catch (error) {
    console.error("[settings] load failed", error);
    return NextResponse.json({ error: "Could not load settings." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    await updateSettings(parsed.data);
    return NextResponse.json({ ok: true, settings: parsed.data });
  } catch (error) {
    console.error("[settings] update failed", error);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
