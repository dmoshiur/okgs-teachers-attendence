import { NextRequest, NextResponse } from "next/server";
import { addTeachersInBulk } from "@/lib/teachers";
import { requireActiveUser } from "@/lib/auth";
import { teacherBulkSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";

/** Pastes many names at once; duplicates inside the batch or already stored are skipped. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireActiveUser();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = teacherBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const result = await addTeachersInBulk(
      parsed.data.names,
      parsed.data.type === "staff" ? "staff" : "teacher"
    );

    return NextResponse.json(
      {
        created: result.created,
        skipped: result.skipped,
        count: result.created.length
      },
      { status: 201 }
    );
  } catch (error) {
    logRouteError("teachers:bulk", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not add those names.", error) },
      { status: 500 }
    );
  }
}
