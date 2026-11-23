import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in"
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const raw = params.next;
  const nextPath =
    raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login")
      ? raw
      : "/";

  return <LoginForm nextPath={nextPath} />;
}
