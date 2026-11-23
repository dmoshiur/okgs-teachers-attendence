import { NextRequest, NextResponse } from "next/server";
import { deleteUser, updateUser, UserError } from "@/lib/users";
import { requireSuperAdmin } from "@/lib/auth";
import { userUpdateSchema } from "@/lib/validation";
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
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    if (
      parsed.data.displayName === undefined &&
      parsed.data.role === undefined &&
      parsed.data.isActive === undefined
    ) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const user = await updateUser(id, parsed.data, auth.user);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logRouteError("users:update", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not update the user.", error) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const { id: rawId } = await context.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "Invalid user id." }, { status: 400 });

    await deleteUser(id, auth.user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logRouteError("users:delete", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not delete the user.", error) },
      { status: 500 }
    );
  }
}
