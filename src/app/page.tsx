import type { Metadata } from "next";
import { GeneratorClient } from "@/components/GeneratorClient";
import { Shell } from "@/components/Shell";
import { getActiveTeachers } from "@/lib/teachers";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Generator"
};

export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  const [teachers, settings] = await Promise.all([getActiveTeachers(), getSettings()]);
  const now = new Date();

  return (
    <Shell
      title="Attendance sheet generator"
      subtitle="Pick a month, check the live preview, then download or print."
    >
      <GeneratorClient
        initialTeacherCount={teachers.length}
        initialMonth={now.getMonth() + 1}
        initialYear={now.getFullYear()}
        settings={{ schoolName: settings.schoolName, titleTemplate: settings.titleTemplate }}
      />
    </Shell>
  );
}
