import { asc, sql } from "drizzle-orm";
import { ensureReady } from "./db";
import { teachers, type TeacherType } from "./schema";
import type { IncludeFilter } from "./validation";

export type TeacherListItem = {
  id: number;
  name: string;
  type: TeacherType;
  designation: string;
  sortOrder: number;
  isActive: boolean;
};

function normalizeType(value: unknown): TeacherType {
  return value === "staff" ? "staff" : "teacher";
}

export async function getTeachers(): Promise<TeacherListItem[]> {
  const db = await ensureReady();
  const rows = await db
    .select({
      id: teachers.id,
      name: teachers.name,
      type: teachers.type,
      designation: teachers.designation,
      sortOrder: teachers.sortOrder,
      isActive: teachers.isActive
    })
    .from(teachers)
    .orderBy(asc(teachers.sortOrder), asc(teachers.id));

  return rows.map((row) => ({
    ...row,
    type: normalizeType(row.type),
    designation: row.designation ?? ""
  }));
}

export async function getActiveTeachers(): Promise<TeacherListItem[]> {
  const all = await getTeachers();
  return all.filter((teacher) => teacher.isActive);
}

/**
 * Applied before the sheet is built, so serial numbers and the 3-per-page
 * pagination are always computed from the filtered list.
 */
export function filterByInclude(
  list: TeacherListItem[],
  include: IncludeFilter | undefined
): TeacherListItem[] {
  if (include === "teachers") return list.filter((teacher) => teacher.type === "teacher");
  if (include === "staff") return list.filter((teacher) => teacher.type === "staff");
  return list;
}

export type BulkAddResult = {
  created: TeacherListItem[];
  skipped: string[];
};

/**
 * Adds many people at once. Names are trimmed, blank lines dropped, and exact
 * duplicates — inside the paste and against names already in the list — are
 * skipped, matching case and ignoring surrounding whitespace.
 */
export async function addTeachersInBulk(
  names: string[],
  type: TeacherType
): Promise<BulkAddResult> {
  const db = await ensureReady();
  const existing = await getTeachers();

  const seen = new Set(existing.map((teacher) => teacher.name.trim().toLowerCase()));
  const skipped: string[] = [];
  const unique: string[] = [];

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      skipped.push(name);
      continue;
    }
    seen.add(key);
    unique.push(name);
  }

  if (unique.length === 0) return { created: [], skipped };

  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${teachers.sortOrder}), 0)` })
    .from(teachers);
  let sortOrder = Number(maxRow?.max ?? 0) + 1;

  const created: TeacherListItem[] = [];
  for (const name of unique) {
    const [row] = await db
      .insert(teachers)
      .values({ name, type, designation: "", sortOrder, isActive: true })
      .returning({
        id: teachers.id,
        name: teachers.name,
        type: teachers.type,
        designation: teachers.designation,
        sortOrder: teachers.sortOrder,
        isActive: teachers.isActive
      });
    if (row) {
      created.push({ ...row, type: normalizeType(row.type), designation: row.designation ?? "" });
    }
    sortOrder += 1;
  }

  return { created, skipped };
}
