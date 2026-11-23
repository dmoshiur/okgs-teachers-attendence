import type { Metadata } from "next";
import { UsersClient } from "@/components/UsersClient";
import { Shell } from "@/components/Shell";
import { AccessDenied } from "@/components/AccessDenied";
import { requireSuperAdminForPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Users"
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const auth = await requireSuperAdminForPage();

  if (!auth.ok) {
    // A plain admin keeps the URL and gets a clear permission screen instead of
    // being silently bounced to the home page.
    return (
      <AccessDenied
        role={auth.user.role}
        displayName={auth.user.displayName || auth.user.username}
        page="Users"
      />
    );
  }

  const user = auth.user;

  return (
    <Shell
      title="Users"
      subtitle="Accounts that can sign in. Super admins also manage users and settings."
      role={user.role}
      displayName={user.displayName || user.username}
    >
      <UsersClient currentUserId={user.id} />
    </Shell>
  );
}
