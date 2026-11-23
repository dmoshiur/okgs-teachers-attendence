import { NextRequest, NextResponse } from "next/server";
import { getActiveTeachers } from "@/lib/teachers";
import { getSettings } from "@/lib/settings";
import { getLogoAsPng } from "@/lib/logo";
import { buildSheet, sheetFileName } from "@/lib/sheet";
import { renderAttendanceDocx } from "@/lib/docx";
import { generateQuerySchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Could not generate the DOCX.";

export async function GET(request: NextRequest) {
  try {
    const parsed = generateQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const [teachers, settings, logo] = await Promise.all([
      getActiveTeachers(),
      getSettings(),
      // Resolves to null (and is skipped) if the logo cannot be read or decoded.
      getLogoAsPng()
    ]);

    const sheet = buildSheet({
      month: parsed.data.month,
      year: parsed.data.year,
      teachers,
      settings
    });

    const buffer = await renderAttendanceDocx(sheet, logo);
    const filename = sheetFileName(sheet, "docx");
    const download = request.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    logRouteError("generate:docx", error);
    return NextResponse.json(
      { error: publicErrorMessage(GENERIC_ERROR, error) },
      { status: 500 }
    );
  }
}
