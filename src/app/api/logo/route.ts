import { NextRequest, NextResponse } from "next/server";
import { getLogo } from "@/lib/logo";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const logo = await getLogo();
    const requestedVersion = request.nextUrl.searchParams.get("v");
    const etag = `"${logo.version}"`;
    const headers = new Headers({
      "Content-Type": logo.mime,
      "Cache-Control":
        requestedVersion === logo.version
          ? "public, max-age=31536000, immutable"
          : "private, no-cache",
      ETag: etag,
      "X-Content-Type-Options": "nosniff"
    });

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    return new NextResponse(new Uint8Array(logo.data), { headers });
  } catch (error) {
    console.error("[logo] failed to read logo", error);
    return NextResponse.json({ error: "Could not load the logo." }, { status: 500 });
  }
}
