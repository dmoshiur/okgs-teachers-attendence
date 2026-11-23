import { asc, eq } from "drizzle-orm";
import { ensureReady } from "./db";
import { teachers } from "./schema";

export type TeacherListItem = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export async function getActiveTeachers(): Promise<TeacherListItem[]> {
  const db = await ensureReady();
  return db
    .select({
      id: teachers.id,
      name: teachers.name,
      sortOrder: teachers.sortOrder,
      isActive: teachers.isActive
    })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(asc(teachers.sortOrder), asc(teachers.id));
}
