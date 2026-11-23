"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { GripVertical, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type Teacher = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const MAX_NAME = 80;

export function TeachersClient() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/teachers", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { teachers?: Teacher[]; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Could not load teachers.");
      setTeachers(data?.teachers ?? []);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load teachers.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (teachers && teachers.length === 0) inputRef.current?.focus();
  }, [teachers]);

  async function addTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError("Enter the teacher's name.");
      return;
    }
    if (adding) return;

    setAdding(true);
    setAddError(null);
    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = (await response.json().catch(() => null)) as {
        teacher?: Teacher;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Could not add the teacher.");
      setTeachers((current) =>
        current ? [...current, data!.teacher!].sort((a, b) => a.sortOrder - b.sortOrder) : current
      );
      setName("");
      toast(`${data?.teacher?.name ?? "Teacher"} added.`);
      inputRef.current?.focus();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Could not add the teacher.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(teacher: Teacher) {
    setEditingId(teacher.id);
    setEditName(teacher.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(id: number) {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast("The name cannot be empty.", "error");
      return;
    }
    if (savingId) return;
    setSavingId(id);
    try {
      const response = await fetch(`/api/teachers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = (await response.json().catch(() => null)) as {
        teacher?: Teacher;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save the change.");
      setTeachers((current) =>
        current
          ? current.map((item) => (item.id === id ? { ...item, ...data!.teacher } : item))
          : current
      );
      setEditingId(null);
      setEditName("");
      toast("Teacher updated.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the change.", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete() {
    if (!confirmId) return;
    const id = confirmId;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not delete the teacher.");
      }
      const target = teachers?.find((item) => item.id === id);
      setTeachers((current) => (current ? current.filter((item) => item.id !== id) : current));
      setConfirmId(null);
      toast(`${target?.name ?? "Teacher"} removed.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the teacher.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (!teachers || target < 0 || target >= teachers.length) return;
    const teacher = teachers[index];
    if (movingId) return;

    const next = [...teachers];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = teachers;
    setTeachers(next);
    setMovingId(teacher.id);

    try {
      const response = await fetch("/api/teachers/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((item) => item.id) })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not reorder teachers.");
      }
      setTeachers(
        next.map((item, position) => ({ ...item, sortOrder: position + 1 }))
      );
      toast("Order saved.");
    } catch (error) {
      setTeachers(previous);
      toast(error instanceof Error ? error.message : "Could not reorder teachers.", "error");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader
          title="Add a teacher"
          description="Names can be in English, Bangla, or both."
        />
        <CardBody>
          <form onSubmit={addTeacher} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="teacher-name" className="text-sm font-semibold text-slate-800">
                Full name
              </label>
              <Input
                ref={inputRef}
                id="teacher-name"
                value={name}
                maxLength={MAX_NAME}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Md. Anwar Hossain"
                disabled={adding}
                autoComplete="off"
              />
              {addError ? <p className="text-xs font-medium text-rose-600">{addError}</p> : null}
            </div>
            <Button
              type="submit"
              loading={adding}
              icon={<Plus className="h-4 w-4" />}
              className="w-full"
            >
              Add teacher
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              New teachers are added to the end of the list. Use the arrows to reorder them —
              the order is the order they appear on the sheet.
            </p>
          </form>
        </CardBody>
      </Card>

      <Card className="min-w-0">
        <CardHeader
          title="Teachers"
          description={
            teachers
              ? `${teachers.length} on the attendance sheet`
              : "Loading the current list…"
          }
          actions={
            teachers ? (
              <Badge tone="blue">
                <Users className="mr-1 h-3 w-3" />
                {Math.max(1, Math.ceil(teachers.length / 3))} page
                {Math.max(1, Math.ceil(teachers.length / 3)) === 1 ? "" : "s"}
              </Badge>
            ) : null
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
          ) : teachers === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Spinner />
              Loading teachers…
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No teachers yet"
              description="Add your first teacher to start building the attendance sheet."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {teachers.map((teacher, index) => {
                const isEditing = editingId === teacher.id;
                const serial = index + 1;
                return (
                  <li
                    key={teacher.id}
                    className={cn(
                      "group flex items-center gap-2 px-1 py-1.5 sm:gap-3",
                      movingId === teacher.id && "opacity-60"
                    )}
                  >
                    <GripVertical
                      className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block"
                      aria-hidden
                    />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-school-50 text-xs font-bold text-school-700">
                      {serial}
                    </span>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <Input
                          value={editName}
                          maxLength={MAX_NAME}
                          onChange={(event) => setEditName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveEdit(teacher.id);
                            }
                            if (event.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          aria-label="Teacher name"
                          className="py-1.5"
                        />
                      ) : (
                        <p className="truncate text-sm font-medium text-slate-900" dir="auto">
                          {teacher.name}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => void move(index, -1)}
                          disabled={index === 0 || movingId !== null}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${teacher.name} up`}
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 10l4-4 4 4" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => void move(index, 1)}
                          disabled={index === teachers.length - 1 || movingId !== null}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${teacher.name} down`}
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6l4 4 4-4" />
                          </svg>
                        </button>
                      </div>

                      {isEditing ? (
                        <>
                          <Button
                            onClick={() => void saveEdit(teacher.id)}
                            loading={savingId === teacher.id}
                            className="px-3 py-1.5 text-xs"
                          >
                            Save
                          </Button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(teacher)}
                            className="rounded-md p-2 text-slate-400 transition hover:bg-school-50 hover:text-school-700"
                            aria-label={`Edit ${teacher.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(teacher.id)}
                            className="rounded-md p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete ${teacher.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {teachers && teachers.length > 0 ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              The first three teachers fill page 1, the next three page 2, and so on.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={confirmId !== null}
        onClose={() => (deletingId ? null : setConfirmId(null))}
        title="Delete this teacher?"
        description={`${teachers?.find((item) => item.id === confirmId)?.name ?? "This teacher"} will be removed from the attendance sheet permanently.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={deletingId !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deletingId !== null}>
              Delete teacher
            </Button>
          </>
        }
      />
    </div>
  );
}
