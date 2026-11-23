"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, Pencil, Power, ShieldCheck, Trash2, UserPlus, XCircle } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import type { AdminRole } from "@/lib/schema";

type User = {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: number;
};

type ModalKind = "add" | "edit" | "password" | null;

function formatDate(epochSeconds: number): string {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function UsersClient({ currentUserId }: { currentUserId: number }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalKind>(null);
  const [target, setTarget] = useState<User | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("admin");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AdminRole>("admin");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { users?: User[]; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Could not load users.");
      setUsers(data?.users ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load users.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(
    () => ({
      total: users?.length ?? 0,
      superAdmins: users?.filter((user) => user.role === "super_admin" && user.isActive).length ?? 0,
      active: users?.filter((user) => user.isActive).length ?? 0
    }),
    [users]
  );

  function openAdd() {
    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("admin");
    setFormError(null);
    setModal("add");
  }

  function openEdit(user: User) {
    setTarget(user);
    setEditName(user.displayName);
    setEditRole(user.role);
    setFormError(null);
    setModal("edit");
  }

  function openPassword(user: User) {
    setTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setFormError(null);
    setModal("password");
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setTarget(null);
    setFormError(null);
  }

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("The password must be at least 8 characters.");
      return;
    }
    if (saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), displayName: displayName.trim(), password, role })
      });
      const data = (await response.json().catch(() => null)) as { user?: User; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not create the user.");
      setUsers((current) => (current ? [...current, data!.user!] : current));
      toast(`Account "${data?.user?.username}" created.`);
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create the user.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || saving) return;
    setFormError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName.trim(), role: editRole })
      });
      const data = (await response.json().catch(() => null)) as { user?: User; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not update the user.");
      setUsers((current) =>
        current ? current.map((user) => (user.id === target.id ? { ...user, ...data!.user } : user)) : current
      );
      toast("Account updated.");
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not update the user.");
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || saving) return;
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError("The password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("The passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/users/${target.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not set the password.");
      toast(`Password reset for ${target.username}.`);
      closeModal();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not set the password.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    if (busyId !== null) return;
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive })
      });
      const data = (await response.json().catch(() => null)) as { user?: User; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not update the user.");
      setUsers((current) =>
        current ? current.map((item) => (item.id === user.id ? { ...item, ...data!.user } : item)) : current
      );
      toast(user.isActive ? `${user.username} deactivated.` : `${user.username} reactivated.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the user.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!confirmId || busyId !== null) return;
    const id = confirmId;
    setBusyId(id);
    try {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not delete the user.");
      const removed = users?.find((user) => user.id === id);
      setUsers((current) => (current ? current.filter((user) => user.id !== id) : current));
      setConfirmId(null);
      toast(`${removed?.username ?? "User"} deleted.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the user.", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader
        title="Accounts"
        description={
          users
            ? `${summary.active} active · ${summary.superAdmins} super admin${
                summary.superAdmins === 1 ? "" : "s"
              }`
            : "Loading accounts…"
        }
        actions={
          <Button onClick={openAdd} icon={<UserPlus className="h-4 w-4" />}>
            Add user
          </Button>
        }
      />
      <CardBody>
        {loadError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <Button variant="secondary" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : users === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Spinner />
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-5 w-5" />}
            title="No users yet"
            description="Add an account so someone else can sign in."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyId === user.id;
              return (
                <li
                  key={user.id}
                  className={cn(
                    "flex flex-col gap-3 px-1 py-3 sm:flex-row sm:items-center",
                    !user.isActive && "opacity-60"
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-school-50 text-sm font-bold text-school-700">
                    {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                      <span className="truncate">{user.displayName || user.username}</span>
                      {isSelf ? <Badge tone="green">You</Badge> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="truncate">@{user.username}</span>
                      <span>· added {formatDate(user.createdAt)}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={user.role === "super_admin" ? "amber" : "blue"}>
                      {user.role === "super_admin" ? "Super admin" : "Admin"}
                    </Badge>
                    <Badge tone={user.isActive ? "green" : "slate"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {isSelf ? (
                    <p className="shrink-0 text-xs text-slate-400 sm:w-40 sm:text-right">
                      Use My account
                    </p>
                  ) : (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        disabled={busy}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-school-50 hover:text-school-700 disabled:opacity-40"
                        aria-label={`Edit ${user.username}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPassword(user)}
                        disabled={busy}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-school-50 hover:text-school-700 disabled:opacity-40"
                        aria-label={`Reset password for ${user.username}`}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(user)}
                        disabled={busy}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                        aria-label={user.isActive ? `Deactivate ${user.username}` : `Reactivate ${user.username}`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(user.id)}
                        disabled={busy}
                        className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        aria-label={`Delete ${user.username}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {users && users.length > 0 ? (
          <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-school-600" />
              Super admins can manage users, settings and staff. Admins can only manage staff and
              print sheets.
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              The last active super admin cannot be deleted, demoted or deactivated.
            </p>
            <p className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              A deactivated account is signed out on its next request and cannot sign in.
            </p>
          </div>
        ) : null}
      </CardBody>

      <Modal
        open={modal === "add"}
        onClose={closeModal}
        title="Add a user"
        description="They can sign in straight away with the password you set."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="add-user-form" loading={saving} icon={<UserPlus className="h-4 w-4" />}>
              Create account
            </Button>
          </>
        }
      >
        <form id="add-user-form" onSubmit={addUser} className="space-y-3">
          <Field label="Username" htmlFor="new-username" hint="Case-insensitive, no spaces">
            <Input
              id="new-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Display name" htmlFor="new-display-name" hint="Shown in the menu">
            <Input
              id="new-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="off"
              dir="auto"
            />
          </Field>
          <Field label="Password" htmlFor="new-password" hint="At least 8 characters">
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Role" htmlFor="new-role">
            <Select
              id="new-role"
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
            >
              <option value="admin">Admin — staff and printing</option>
              <option value="super_admin">Super admin — everything</option>
            </Select>
          </Field>
          {formError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={modal === "edit"}
        onClose={closeModal}
        title={`Edit ${target?.username ?? "user"}`}
        description="Change the display name or the role."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form" loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={saveEdit} className="space-y-3">
          <Field label="Display name" htmlFor="edit-display-name">
            <Input
              id="edit-display-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              dir="auto"
              required
            />
          </Field>
          <Field label="Role" htmlFor="edit-role">
            <Select
              id="edit-role"
              value={editRole}
              onChange={(event) => setEditRole(event.target.value as AdminRole)}
            >
              <option value="admin">Admin — staff and printing</option>
              <option value="super_admin">Super admin — everything</option>
            </Select>
          </Field>
          {formError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={modal === "password"}
        onClose={closeModal}
        title={`Reset password for ${target?.username ?? "user"}`}
        description="They will need the new password the next time they sign in."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="password-user-form" loading={saving} icon={<KeyRound className="h-4 w-4" />}>
              Set password
            </Button>
          </>
        }
      >
        <form id="password-user-form" onSubmit={savePassword} className="space-y-3">
          <Field label="New password" htmlFor="reset-password" hint="At least 8 characters">
            <Input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="reset-password-confirm">
            <Input
              id="reset-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {formError ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={confirmId !== null}
        onClose={() => (busyId !== null ? null : setConfirmId(null))}
        title="Delete this user?"
        description={`${
          users?.find((user) => user.id === confirmId)?.username ?? "This user"
        } will not be able to sign in any more.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={busyId !== null}>
              Delete user
            </Button>
          </>
        }
      />
    </Card>
  );
}
