import type { Metadata } from "next";
import { AccountClient } from "@/components/AccountClient";
import { Shell } from "@/components/Shell";
import { requireUserOrRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "My account"
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUserOrRedirect();

  return (
    <Shell
      title="My account"
      subtitle="Your own name and password. User management lives on the Users page."
      role={user.role}
      displayName={user.displayName || user.username}
    >
      <AccountClient
        currentUsername={user.username}
        currentDisplayName={user.displayName || user.username}
        role={user.role}
      />
    </Shell>
  );
}
