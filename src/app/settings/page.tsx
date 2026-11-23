import type { Metadata } from "next";
import { SettingsClient } from "@/components/SettingsClient";
import { Shell } from "@/components/Shell";
import { getSettings } from "@/lib/settings";
import { getLogoVersion } from "@/lib/logo";

export const metadata: Metadata = {
  title: "Settings"
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, logoVersion] = await Promise.all([getSettings(), getLogoVersion()]);

  return (
    <Shell
      title="Settings"
      subtitle="School branding, print options and your admin account."
    >
      <SettingsClient
        initialSettings={{
          schoolName: settings.schoolName,
          titleTemplate: settings.titleTemplate,
          fillEmptySlots: settings.fillEmptySlots,
          zebra: settings.zebra
        }}
        initialLogoVersion={logoVersion}
      />
    </Shell>
  );
}
