import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession, getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // A signed-in visitor with a live account has no reason to see this page.
  // getSessionUser reads the account from the database, so a deactivated user is
  // not redirected back into the app.
  const session = await getSession();
  const user = session ? await getSessionUser() : null;

  if (user) redirect("/");

  // The cookie is signed but its account is gone or deactivated: send them
  // through the route handler that clears it (a page cannot write cookies), then
  // back here to sign in.
  if (session) redirect("/api/auth/clear?next=/login");

  const params = await searchParams;
  const raw = params.next;
  const nextPath =
    raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")
      ? raw
      : "/";

  return <LoginForm nextPath={nextPath} />;
}
