import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { teachers, type TeacherType } from "@/lib/schema";
import { requireUser } from "@/lib/auth";
import { teacherUpdateSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

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
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid teacher id." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = teacherUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const patch = parsed.data;
    if (
      patch.name === undefined &&
      patch.type === undefined &&
      patch.designation === undefined &&
      patch.isActive === undefined
    ) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const db = await ensureReady();
    const [updated] = await db
      .update(teachers)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.type !== undefined ? { type: patch.type as TeacherType } : {}),
        ...(patch.designation !== undefined ? { designation: patch.designation } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {})
      })
      .where(eq(teachers.id, id))
      .returning({
        id: teachers.id,
        name: teachers.name,
        type: teachers.type,
        designation: teachers.designation,
        sortOrder: teachers.sortOrder,
        isActive: teachers.isActive
      });

    if (!updated) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    return NextResponse.json({
      teacher: {
        ...updated,
        type: (updated.type === "staff" ? "staff" : "teacher") as TeacherType,
        designation: updated.designation ?? ""
      }
    });
  } catch (error) {
    logRouteError("teachers:update", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not update the teacher.", error) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

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
    logRouteError("teachers:delete", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not delete the teacher.", error) },
      { status: 500 }
    );
  }
}
