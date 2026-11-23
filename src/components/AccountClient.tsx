"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Save } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { AdminRole } from "@/lib/schema";

export function AccountClient({
  currentUsername,
  currentDisplayName,
  role
}: {
  currentUsername: string;
  currentDisplayName: string;
  role: AdminRole;
}) {
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [savedName, setSavedName] = useState(currentDisplayName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);

    if (!displayName.trim()) {
      setNameError("Enter a display name.");
      return;
    }
    if (savingName) return;

    setSavingName(true);
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save your profile.");
      setSavedName(displayName.trim());
      toast("Profile updated.");
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("The new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    if (savingPassword) return;

    setSavingPassword(true);
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not change the password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not change the password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Profile"
          description="This name is shown in the menu and on the Users page."
        />
        <CardBody>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-school-600 text-sm font-bold text-white">
                {(displayName || currentUsername).slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{currentUsername}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Badge tone={role === "super_admin" ? "amber" : "blue"}>
                    {role === "super_admin" ? "Super admin" : "Admin"}
                  </Badge>
                  Username cannot be changed
                </p>
              </div>
            </div>

            <Field label="Display name" htmlFor="display-name">
              <Input
                id="display-name"
                value={displayName}
                maxLength={120}
                onChange={(event) => setDisplayName(event.target.value)}
                dir="auto"
                autoComplete="off"
              />
            </Field>

            {nameError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {nameError}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                loading={savingName}
                disabled={!displayName.trim() || displayName.trim() === savedName}
                icon={<Save className="h-4 w-4" />}
              >
                Save profile
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Change password"
          description="Enter your current password to set a new one."
        />
        <CardBody>
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Current password" htmlFor="account-current-password">
              <Input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="account-new-password" hint="At least 8 characters">
                <Input
                  id="account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </Field>
              <Field label="Confirm new password" htmlFor="account-confirm-password">
                <Input
                  id="account-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </Field>
            </div>

            {passwordError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {passwordError}
              </p>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="submit"
                loading={savingPassword}
                icon={<KeyRound className="h-4 w-4" />}
              >
                Change password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
