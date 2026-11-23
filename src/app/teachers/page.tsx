import type { Metadata } from "next";
import { TeachersClient } from "@/components/TeachersClient";
import { Shell } from "@/components/Shell";
import { requireActiveUserOrRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Staff & Teachers"
};

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const user = await requireActiveUserOrRedirect();

  return (
    <Shell
      title="Staff & Teachers"
      subtitle="The order here is the order on the sheet — three people per page."
      role={user.role}
      displayName={user.displayName || user.username}
    >
      <TeachersClient />
    </Shell>
  );
}
