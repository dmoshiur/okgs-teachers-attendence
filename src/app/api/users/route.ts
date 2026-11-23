import { NextRequest, NextResponse } from "next/server";
import { listUsers, createUser, UserError } from "@/lib/users";
import { requireSuperAdmin } from "@/lib/auth";
import { userCreateSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    logRouteError("users:list", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not load users.", error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const user = await createUser(parsed.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logRouteError("users:create", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not create the user.", error) },
      { status: 500 }
    );
  }
}
