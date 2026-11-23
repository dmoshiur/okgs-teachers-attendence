import type { Metadata } from "next";
import { SettingsClient } from "@/components/SettingsClient";
import { Shell } from "@/components/Shell";
import { AccessDenied } from "@/components/AccessDenied";
import { getSettings } from "@/lib/settings";
import { getLogoVersion } from "@/lib/logo";
import { requireSuperAdminForPage } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings"
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireSuperAdminForPage();

  if (!auth.ok) {
    // A plain admin keeps the URL and gets a clear permission screen instead of
    // being silently bounced to the home page.
    return (
      <AccessDenied
        role={auth.user.role}
        displayName={auth.user.displayName || auth.user.username}
        page="Settings"
      />
    );
  }

  const user = auth.user;
  const [settings, logoVersion] = await Promise.all([getSettings(), getLogoVersion()]);

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
