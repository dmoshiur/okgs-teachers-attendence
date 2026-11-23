import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { teachers } from "@/lib/schema";
import { teacherUpdateSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid teacher id." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = teacherUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    if (parsed.data.name === undefined && parsed.data.isActive === undefined) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const db = await ensureReady();
    const [updated] = await db
      .update(teachers)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
      })
      .where(eq(teachers.id, id))
      .returning({
        id: teachers.id,
        name: teachers.name,
        sortOrder: teachers.sortOrder,
        isActive: teachers.isActive
      });

    if (!updated) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    return NextResponse.json({ teacher: updated });
  } catch (error) {
    console.error("[teachers] update failed", error);
    return NextResponse.json({ error: "Could not update the teacher." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid teacher id." }, { status: 400 });

    const db = await ensureReady();
    const deleted = await db.delete(teachers).where(eq(teachers.id, id)).returning({ id: teachers.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[teachers] delete failed", error);
    return NextResponse.json({ error: "Could not delete the teacher." }, { status: 500 });
  }
}
