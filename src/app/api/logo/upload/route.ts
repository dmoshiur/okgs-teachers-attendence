import { NextRequest, NextResponse } from "next/server";
import { MAX_LOGO_BYTES, saveLogo } from "@/lib/logo";
import { requireSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml"
]);

const ACCEPTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a logo file to upload." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be 5 MB or smaller." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const looksAccepted =
      ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!looksAccepted) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPG, WebP or SVG file." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await saveLogo(bytes);

    return NextResponse.json({ ok: true, version: result.version, mime: result.mime });
  } catch (error) {
    console.error("[logo] upload failed", error);
    const message =
      error instanceof Error && error.message.includes("Unsupported")
        ? error.message
        : "Could not process that image. Please try a different file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
