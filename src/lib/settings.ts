import { ensureReady } from "./db";
import { settings } from "./schema";

export type AppSettings = {
  schoolName: string;
  titleTemplate: string;
  fillEmptySlots: boolean;
  zebra: boolean;
};

export const DEFAULT_TITLE_TEMPLATE = "Teachers Attendance Sheet, {Month}-{Year}";

export function getDefaultSettings(): AppSettings {
  return {
    schoolName: process.env.SCHOOL_NAME?.trim() || "Your School Name",
    titleTemplate: DEFAULT_TITLE_TEMPLATE,
    fillEmptySlots: true,
    zebra: true
  };
}

export async function getSettings(): Promise<AppSettings> {
  const db = await ensureReady();
  const rows = await db.select().from(settings);
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const fallback = getDefaultSettings();
  return {
    schoolName: map.get("school_name") || fallback.schoolName,
    titleTemplate: map.get("title_template") || fallback.titleTemplate,
    fillEmptySlots: (map.get("fill_empty_slots") ?? "true") !== "false",
    zebra: (map.get("zebra") ?? "true") !== "false"
  };
}

export async function updateSettings(input: AppSettings): Promise<void> {
  const db = await ensureReady();
  const entries: Array<{ key: string; value: string }> = [
    { key: "school_name", value: input.schoolName },
    { key: "title_template", value: input.titleTemplate },
    { key: "fill_empty_slots", value: input.fillEmptySlots ? "true" : "false" },
    { key: "zebra", value: input.zebra ? "true" : "false" }
  ];

  for (const entry of entries) {
    await db
      .insert(settings)
      .values(entry)
      .onConflictDoUpdate({ target: settings.key, set: { value: entry.value } });
  }
}
