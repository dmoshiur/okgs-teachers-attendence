import { NextRequest, NextResponse } from "next/server";
import { getActiveTeachers } from "@/lib/teachers";
import { getSettings } from "@/lib/settings";
import { getLogoAsPng } from "@/lib/logo";
import { buildSheet, sheetFileName } from "@/lib/sheet";
import { renderAttendancePdf } from "@/lib/pdf";
import { generateQuerySchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      getLogoAsPng()
    ]);

    const sheet = buildSheet({
      month: parsed.data.month,
      year: parsed.data.year,
      teachers,
      settings
    });

    const buffer = await renderAttendancePdf(sheet, logo);
    const filename = sheetFileName(sheet, "pdf");
    const download = request.nextUrl.searchParams.get("download") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("[generate] PDF failed", error);
    return NextResponse.json({ error: "Could not generate the PDF." }, { status: 500 });
  }
}
