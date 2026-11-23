import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { teachers, type TeacherType } from "@/lib/schema";
import { getTeachers } from "@/lib/teachers";
import { requireUser } from "@/lib/auth";
import { teacherCreateSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const list = await getTeachers();
    return NextResponse.json({ teachers: list });
  } catch (error) {
    logRouteError("teachers:list", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not load teachers.", error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = teacherCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const db = await ensureReady();
    const [row] = await db
      .select({ max: sql<number>`coalesce(max(${teachers.sortOrder}), 0)` })
      .from(teachers);
    const sortOrder = Number(row?.max ?? 0) + 1;

    const type: TeacherType = parsed.data.type === "staff" ? "staff" : "teacher";

    const [created] = await db
      .insert(teachers)
      .values({
        name: parsed.data.name,
        type,
        designation: parsed.data.designation?.trim() ?? "",
        sortOrder,
        isActive: true
      })
      .returning({
        id: teachers.id,
        name: teachers.name,
        type: teachers.type,
        designation: teachers.designation,
        sortOrder: teachers.sortOrder,
        isActive: teachers.isActive
      });

    return NextResponse.json(
      { teacher: { ...created, type, designation: created.designation ?? "" } },
      { status: 201 }
    );
  } catch (error) {
    logRouteError("teachers:create", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not add the teacher.", error) },
      { status: 500 }
    );
  }
}
