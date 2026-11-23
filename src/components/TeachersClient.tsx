"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ClipboardPaste,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner
} from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type TeacherType = "teacher" | "staff";

type Person = {
  id: number;
  name: string;
  type: TeacherType;
  designation: string;
  sortOrder: number;
  isActive: boolean;
};

type Filter = "all" | TeacherType;

const MAX_NAME = 80;
const MAX_DESIGNATION = 60;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "teacher", label: "Teachers" },
  { id: "staff", label: "Staff" }
];

function typeLabel(type: TeacherType): string {
  return type === "staff" ? "Staff" : "Teacher";
}

/** Splits pasted text into unique names, keeping the first spelling of each. */
function parseNames(text: string): Array<{ name: string; duplicate: boolean }> {
  const seen = new Set<string>();
  const result: Array<{ name: string; duplicate: boolean }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const name = rawLine.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      result.push({ name, duplicate: true });
      continue;
    }
    seen.add(key);
    result.push({ name, duplicate: false });
  }

  return result;
}

export function TeachersClient() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Person[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [type, setType] = useState<TeacherType>("teacher");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState<TeacherType>("teacher");
  const [addingBulk, setAddingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<TeacherType>("teacher");
  const [editDesignation, setEditDesignation] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bulkRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/teachers", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = (await response.json().catch(() => null)) as
        | { teachers?: Person[]; error?: string }
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

  useEffect(() => {
    if (bulkOpen) bulkRef.current?.focus();
  }, [bulkOpen]);

  const existingNames = useMemo(
    () => new Set((teachers ?? []).map((teacher) => teacher.name.trim().toLowerCase())),
    [teachers]
  );

  const bulkPreview = useMemo(() => {
    const parsed = parseNames(bulkText);
    return parsed.map((entry) => ({
      ...entry,
      alreadySaved: existingNames.has(entry.name.toLowerCase())
    }));
  }, [bulkText, existingNames]);

  const bulkNew = bulkPreview.filter((entry) => !entry.duplicate && !entry.alreadySaved);
  const bulkSkipped = bulkPreview.filter((entry) => entry.duplicate || entry.alreadySaved);

  // Reordering only makes sense in the full, unfiltered list: with a filter or a
  // search active the arrows would appear to move a person past invisible rows.
  const reorderable = filter === "all" && query.trim().length === 0;

  const visible = useMemo(() => {
    if (!teachers) return [];
    const needle = query.trim().toLowerCase();
    return teachers.filter((teacher) => {
      if (filter !== "all" && teacher.type !== filter) return false;
      if (!needle) return true;
      return (
        teacher.name.toLowerCase().includes(needle) ||
        teacher.designation.toLowerCase().includes(needle)
      );
    });
  }, [teachers, filter, query]);

  const counts = useMemo(
    () => ({
      all: teachers?.length ?? 0,
      teacher: teachers?.filter((teacher) => teacher.type === "teacher").length ?? 0,
      staff: teachers?.filter((teacher) => teacher.type === "staff").length ?? 0
    }),
    [teachers]
  );

  async function addTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setAddError("Enter the person's name.");
      return;
    }
    if (adding) return;

    setAdding(true);
    setAddError(null);
    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, type, designation: designation.trim() })
      });
      const data = (await response.json().catch(() => null)) as
        | { teacher?: Person; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Could not add the teacher.");
      setTeachers((current) =>
        current
          ? [...current, data!.teacher!].sort((a, b) => a.sortOrder - b.sortOrder)
          : current
      );
      setName("");
      setDesignation("");
      toast(`${data?.teacher?.name ?? "Teacher"} added.`);
      inputRef.current?.focus();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Could not add the teacher.");
    } finally {
      setAdding(false);
    }
  }

  async function addBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bulkNew.length === 0) {
      setBulkError("Paste at least one name that is not already in the list.");
      return;
    }
    if (addingBulk) return;

    setAddingBulk(true);
    setBulkError(null);
    try {
      const response = await fetch("/api/teachers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: bulkNew.map((entry) => entry.name), type: bulkType })
      });
      const data = (await response.json().catch(() => null)) as
        | { created?: Person[]; skipped?: string[]; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Could not add those names.");

      setTeachers((current) =>
        current
          ? [...current, ...(data?.created ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
          : current
      );
      const added = data?.created?.length ?? 0;
      const skipped = (data?.skipped?.length ?? 0) + bulkSkipped.length;
      toast(
        `${added} ${added === 1 ? "person" : "people"} added.` +
          (skipped > 0 ? ` ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.` : "")
      );
      setBulkText("");
      setBulkOpen(false);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Could not add those names.");
    } finally {
      setAddingBulk(false);
    }
  }

  function startEdit(teacher: Person) {
    setEditingId(teacher.id);
    setEditName(teacher.name);
    setEditType(teacher.type);
    setEditDesignation(teacher.designation);
    setEditActive(teacher.isActive);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDesignation("");
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
        body: JSON.stringify({
          name: trimmed,
          type: editType,
          designation: editDesignation.trim(),
          isActive: editActive
        })
      });
      const data = (await response.json().catch(() => null)) as
        | { teacher?: Person; error?: string }
        | null;
      if (!response.ok) throw new Error(data?.error || "Could not save the change.");
      setTeachers((current) =>
        current
          ? current.map((item) => (item.id === id ? { ...item, ...data!.teacher } : item))
          : current
      );
      setEditingId(null);
      toast("Details updated.");
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
        throw new Error(data?.error || "Could not delete this person.");
      }
      const target = teachers?.find((item) => item.id === id);
      setTeachers((current) => (current ? current.filter((item) => item.id !== id) : current));
      setConfirmId(null);
      toast(`${target?.name ?? "Person"} removed.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete this person.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!teachers) return;
    const target = index + direction;
    if (target < 0 || target >= teachers.length) return;

    const person = teachers[index];
    if (movingId) return;

    const next = [...teachers];
    [next[index], next[target]] = [next[target], next[index]];
    const previous = teachers;
    setTeachers(next);
    setMovingId(person.id);

    try {
      const response = await fetch("/api/teachers/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((item) => item.id) })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not reorder the list.");
      }
      setTeachers(next.map((item, position) => ({ ...item, sortOrder: position + 1 })));
      toast("Order saved.");
    } catch (error) {
      setTeachers(previous);
      toast(error instanceof Error ? error.message : "Could not reorder the list.", "error");
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-6 self-start">
        <Card>
          <CardHeader
            title="Add a person"
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
                  dir="auto"
                />
                {addError ? <p className="text-xs font-medium text-rose-600">{addError}</p> : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="teacher-type" className="text-sm font-semibold text-slate-800">
                  Type
                </label>
                <Select
                  id="teacher-type"
                  value={type}
                  onChange={(event) => setType(event.target.value as TeacherType)}
                  disabled={adding}
                >
                  <option value="teacher">Teacher</option>
                  <option value="staff">Staff</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-designation"
                  className="text-sm font-semibold text-slate-800"
                >
                  Designation <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <Input
                  id="teacher-designation"
                  value={designation}
                  maxLength={MAX_DESIGNATION}
                  onChange={(event) => setDesignation(event.target.value)}
                  placeholder="e.g. Head Teacher"
                  disabled={adding}
                  autoComplete="off"
                  dir="auto"
                />
              </div>

              <Button
                type="submit"
                loading={adding}
                icon={<Plus className="h-4 w-4" />}
                className="w-full"
              >
                Add {type === "staff" ? "staff member" : "teacher"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                New people go to the end of the list. Use the arrows to reorder them — the
                order is the order they appear on the sheet.
              </p>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Bulk add"
            description="Paste many names, one per line."
            actions={
              <Button
                variant="outline"
                onClick={() => setBulkOpen((open) => !open)}
                icon={<ClipboardPaste className="h-4 w-4" />}
                className="px-3 py-1.5 text-xs"
              >
                {bulkOpen ? "Hide" : "Paste names"}
              </Button>
            }
          />
          {bulkOpen ? (
            <CardBody>
              <form onSubmit={addBulk} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="bulk-names" className="text-sm font-semibold text-slate-800">
                    Names, one per line
                  </label>
                  <textarea
                    ref={bulkRef}
                    id="bulk-names"
                    value={bulkText}
                    onChange={(event) => setBulkText(event.target.value)}
                    rows={6}
                    spellCheck={false}
                    dir="auto"
                    placeholder={"মোঃ আনোয়ার হোসেন\nMd. Rafiqul Islam\nAbu Kalam"}
                    className="block w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-school-500"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Blank lines are ignored. Duplicate names are skipped.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="bulk-type" className="text-sm font-semibold text-slate-800">
                    Type for this batch
                  </label>
                  <Select
                    id="bulk-type"
                    value={bulkType}
                    onChange={(event) => setBulkType(event.target.value as TeacherType)}
                    disabled={addingBulk}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="staff">Staff</option>
                  </Select>
                </div>

                {bulkPreview.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Detected {bulkPreview.length} name{bulkPreview.length === 1 ? "" : "s"} ·{" "}
                      <span className="text-school-700">{bulkNew.length} to add</span>
                      {bulkSkipped.length > 0 ? (
                        <span className="text-slate-500">
                          {" "}
                          · {bulkSkipped.length} skipped
                        </span>
                      ) : null}
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-auto pr-1">
                      {bulkPreview.map((entry, index) => {
                        const skipped = entry.duplicate || entry.alreadySaved;
                        return (
                          <li
                            key={`${entry.name}-${index}`}
                            className={cn(
                              "flex items-center justify-between gap-2 text-xs",
                              skipped ? "text-slate-400 line-through" : "text-slate-700"
                            )}
                          >
                            <span className="truncate" dir="auto">
                              {entry.name}
                            </span>
                            {skipped ? (
                              <span className="shrink-0 text-[11px]">
                                {entry.alreadySaved ? "already in list" : "duplicate"}
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}

                {bulkError ? (
                  <p className="text-xs font-medium text-rose-600">{bulkError}</p>
                ) : null}

                <Button
                  type="submit"
                  loading={addingBulk}
                  disabled={bulkNew.length === 0}
                  icon={<Plus className="h-4 w-4" />}
                  className="w-full"
                >
                  Add all ({bulkNew.length})
                </Button>
              </form>
            </CardBody>
          ) : null}
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader
          title="Staff & Teachers"
          description={
            teachers
              ? `${counts.teacher} teacher${counts.teacher === 1 ? "" : "s"} · ${counts.staff} staff`
              : "Loading the current list…"
          }
          actions={
            teachers ? (
              <Badge tone="blue">
                <Users className="mr-1 h-3 w-3" />
                {Math.max(1, Math.ceil(counts.all / 3))} page
                {Math.max(1, Math.ceil(counts.all / 3)) === 1 ? "" : "s"}
              </Badge>
            ) : null
          }
        />
        <CardBody>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    filter === option.id
                      ? "bg-white text-school-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {option.label}
                  <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                    {counts[option.id]}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search names…"
                aria-label="Search people"
                className="pl-9 pr-9"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

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
              Loading people…
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No one here yet"
              description="Add a teacher or staff member to start building the attendance sheet."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="Nothing matches"
              description="Try a different search, or switch back to All."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((teacher) => {
                const isEditing = editingId === teacher.id;
                const serial = teachers.findIndex((item) => item.id === teacher.id) + 1;
                const index = teachers.findIndex((item) => item.id === teacher.id);
                return (
                  <li
                    key={teacher.id}
                    className={cn(
                      "group flex items-start gap-2 px-1 py-2 sm:gap-3",
                      movingId === teacher.id && "opacity-60",
                      !teacher.isActive && "opacity-55"
                    )}
                  >
                    <GripVertical
                      className="mt-2 hidden h-4 w-4 shrink-0 text-slate-300 sm:block"
                      aria-hidden
                    />
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-school-50 text-xs font-bold text-school-700">
                      {serial}
                    </span>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-2 py-1">
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
                            aria-label="Name"
                            dir="auto"
                            className="py-1.5"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={editType}
                              onChange={(event) => setEditType(event.target.value as TeacherType)}
                              aria-label="Type"
                              className="rounded-lg border-0 bg-white px-2.5 py-1.5 text-xs text-slate-800 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-school-500"
                            >
                              <option value="teacher">Teacher</option>
                              <option value="staff">Staff</option>
                            </select>
                            <Input
                              value={editDesignation}
                              maxLength={MAX_DESIGNATION}
                              onChange={(event) => setEditDesignation(event.target.value)}
                              placeholder="Designation (optional)"
                              aria-label="Designation"
                              dir="auto"
                              className="w-44 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setEditActive((value) => !value)}
                              className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-school-700"
                            >
                              {editActive ? "Active" : "Inactive"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium text-slate-900" dir="auto">
                            {teacher.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={teacher.type === "staff" ? "amber" : "blue"}>
                              {typeLabel(teacher.type)}
                            </Badge>
                            {teacher.designation ? (
                              <span className="truncate text-xs text-slate-500" dir="auto">
                                {teacher.designation}
                              </span>
                            ) : null}
                            {!teacher.isActive ? (
                              <Badge tone="slate">Inactive</Badge>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => void move(index, -1)}
                          disabled={!reorderable || index === 0 || movingId !== null}
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
                          disabled={!reorderable || index === teachers.length - 1 || movingId !== null}
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
              The first three people fill page 1, the next three page 2, and so on. Serial numbers
              follow this order and are renumbered automatically.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={confirmId !== null}
        onClose={() => (deletingId ? null : setConfirmId(null))}
        title="Delete this person?"
        description={`${teachers?.find((item) => item.id === confirmId)?.name ?? "This person"} will be removed from the attendance sheet permanently.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={deletingId !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deletingId !== null}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
