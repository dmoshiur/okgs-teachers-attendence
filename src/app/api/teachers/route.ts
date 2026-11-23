import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ensureReady } from "@/lib/db";
import { teachers } from "@/lib/schema";
import { getActiveTeachers } from "@/lib/teachers";
import { teacherCreateSchema } from "@/lib/validation";
import { firstIssue } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await getActiveTeachers();
    return NextResponse.json({ teachers: list });
  } catch (error) {
    console.error("[teachers] list failed", error);
    return NextResponse.json({ error: "Could not load teachers." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const [created] = await db
      .insert(teachers)
      .values({ name: parsed.data.name, sortOrder, isActive: true })
      .returning({
        id: teachers.id,
        name: teachers.name,
        sortOrder: teachers.sortOrder,
        isActive: teachers.isActive
      });

    return NextResponse.json({ teacher: created }, { status: 201 });
  } catch (error) {
    console.error("[teachers] create failed", error);
    return NextResponse.json({ error: "Could not add the teacher." }, { status: 500 });
  }
}
