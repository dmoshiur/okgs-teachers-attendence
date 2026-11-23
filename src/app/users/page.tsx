import type { Metadata } from "next";
import { UsersClient } from "@/components/UsersClient";
import { Shell } from "@/components/Shell";
import { requireSuperAdminOrRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Users"
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireSuperAdminOrRedirect();

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
