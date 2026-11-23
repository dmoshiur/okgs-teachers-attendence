import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateOwnAccount, UserError } from "@/lib/users";
import { accountPasswordSchema, accountProfileSchema } from "@/lib/validation";
import { firstIssue, logRouteError, publicErrorMessage } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { user } = auth;
  return NextResponse.json({
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role
  });
}

/**
 * PUT /api/account
 *   { displayName }                      -> update the profile
 *   { currentPassword, newPassword }     -> change the password
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "newPassword" in body) {
      const parsed = accountPasswordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
      }

      const updated = await updateOwnAccount(auth.user, {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    const parsed = accountProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
    }

    const updated = await updateOwnAccount(auth.user, {
      displayName: parsed.data.displayName
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    if (error instanceof UserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logRouteError("account:update", error);
    return NextResponse.json(
      { error: publicErrorMessage("Could not update your account.", error) },
      { status: 500 }
    );
  }
}
