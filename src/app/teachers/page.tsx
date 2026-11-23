import type { Metadata } from "next";
import { TeachersClient } from "@/components/TeachersClient";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Teachers"
};

export const dynamic = "force-dynamic";

export default function TeachersPage() {
  return (
    <Shell
      title="Teachers"
      subtitle="The order here is the order on the sheet — three teachers per page."
    >
      <TeachersClient />
    </Shell>
  );
}
