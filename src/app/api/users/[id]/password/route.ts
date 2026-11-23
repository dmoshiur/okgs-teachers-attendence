import { NextRequest, NextResponse } from "next/server";
import { setUserPassword, UserError } from "@/lib/users";
import { requireSuperAdmin } from "@/lib/auth";
import { userPasswordSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A super admin sets a new password for another account. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = userPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    await setUserPassword(id, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logRouteError("users:password", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not set the password.", error) },
      { status: 500 }
    );
  }
}
