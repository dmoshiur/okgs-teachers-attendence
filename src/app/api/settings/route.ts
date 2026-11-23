import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { getLogoVersion } from "@/lib/logo";
import { settingsSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";
import { requireSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const [settings, logoVersion] = await Promise.all([getSettings(), getLogoVersion()]);
    return NextResponse.json({ settings, logoVersion });
  } catch (error) {
    logRouteError("settings:load", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not load settings.", error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    await updateSettings(parsed.data);
    return NextResponse.json({ ok: true, settings: parsed.data });
  } catch (error) {
    logRouteError("settings:update", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not save settings.", error) },
      { status: 500 }
    );
  }
}
