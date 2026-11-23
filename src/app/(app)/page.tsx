import type { Metadata } from "next";
import { GeneratorClient } from "@/components/GeneratorClient";
import { Shell } from "@/components/Shell";
import { getActiveTeachers } from "@/lib/teachers";
import { getSettings } from "@/lib/settings";
import { requireUserOrRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Generator"
};

export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  const [user, teachers, settings] = await Promise.all([
    requireUserOrRedirect(),
    getActiveTeachers(),
    getSettings()
  ]);
  const now = new Date();

  return (
    <Shell
      title="Attendance sheet generator"
      subtitle="Pick a month, check the live preview, then download or print."
      role={user.role}
      displayName={user.displayName || user.username}
    >
      <GeneratorClient
        initialCounts={{
          all: teachers.length,
          teachers: teachers.filter((teacher) => teacher.type === "teacher").length,
          staff: teachers.filter((teacher) => teacher.type === "staff").length
        }}
        initialMonth={now.getMonth() + 1}
        initialYear={now.getFullYear()}
        settings={{ schoolName: settings.schoolName, titleTemplate: settings.titleTemplate }}
      />
    </Shell>
  );
}
