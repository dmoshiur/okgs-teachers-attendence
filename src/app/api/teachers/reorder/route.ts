import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { teachers } from "@/lib/schema";
import { reorderSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const ids = parsed.data.ids;
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "Duplicate teacher ids." }, { status: 400 });
    }

    const db = await ensureReady();
    const missing = await db.transaction(async (tx) => {
      for (let index = 0; index < ids.length; index += 1) {
        const updated = await tx
          .update(teachers)
          .set({ sortOrder: index + 1 })
          .where(eq(teachers.id, ids[index]))
          .returning({ id: teachers.id });
        if (updated.length === 0) return ids[index];
      }
      return null;
    });

    if (missing !== null) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[teachers] reorder failed", error);
    return NextResponse.json({ error: "Could not reorder teachers." }, { status: 500 });
  }
}
