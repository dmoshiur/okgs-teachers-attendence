import type { Metadata } from "next";
import { SettingsClient } from "@/components/SettingsClient";
import { Shell } from "@/components/Shell";
import { getSettings } from "@/lib/settings";
import { getLogoVersion } from "@/lib/logo";
import { requireSuperAdminOrRedirect } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings"
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, settings, logoVersion] = await Promise.all([
    requireSuperAdminOrRedirect(),
    getSettings(),
    getLogoVersion()
  ]);

  return (
    <Shell
      title="Settings"
      subtitle="School branding and print options for every sheet."
      role={user.role}
      displayName={user.displayName || user.username}
    >
      <SettingsClient
        initialSettings={{
          schoolName: settings.schoolName,
          titleTemplate: settings.titleTemplate,
          fillEmptySlots: settings.fillEmptySlots,
          zebra: settings.zebra,
          showDesignation: settings.showDesignation
        }}
        initialLogoVersion={logoVersion}
      />
    </Shell>
  );
}
