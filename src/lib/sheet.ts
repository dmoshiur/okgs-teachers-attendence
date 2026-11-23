import type { AppSettings } from "./settings";
import type { TeacherListItem } from "./teachers";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

/** Sheet geometry copied from the reference DOCX (twips converted to points). */
export const PAGE_WIDTH = 595.28; // A4 width in points
export const PAGE_HEIGHT = 841.89; // A4 height in points
export const PAGE_MARGIN = 18; // 0.635 cm
export const HEADER_TOP = 36; // 1.27 cm from the page edge
export const TABLE_WIDTH_TWIPS = 9952;
export const TABLE_WIDTH = TABLE_WIDTH_TWIPS / 20; // 497.6 pt
export const TABLE_LEFT = (PAGE_WIDTH - TABLE_WIDTH) / 2;
export const COLUMN_WIDTHS_TWIPS = [632, 882, 1200, 1032, 993, 1107, 1044, 863, 1144, 1055] as const;
export const COLUMN_WIDTHS = COLUMN_WIDTHS_TWIPS.map((width) => width / 20);
export const NAME_ROW_HEIGHT = 314 / 20; // 15.7 pt
export const NAME_ROW_HEIGHT_BENGALI = 18.5;
export const HEADER_ROW_HEIGHT = 20;
export const DAY_ROW_HEIGHT = 20;
export const EMPTY_PARAGRAPH_HEIGHT = 13.4;
export const TINOS_LINE_HEIGHT_RATIO = 1.15;
export const BENGALI_LINE_HEIGHT_RATIO = 1.594;

export type SheetSlot = {
  serial: number;
  name: string;
  empty: boolean;
};

export type SheetData = {
  month: number;
  year: number;
  monthName: string;
  days: number;
  title: string;
  schoolName: string;
  fillEmptySlots: boolean;
  zebra: boolean;
  pages: SheetSlot[][];
  teacherCount: number;
};

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isBengaliCodePoint(codePoint: number): boolean {
  return codePoint >= 0x0980 && codePoint <= 0x09ff;
}

export function containsBengali(text: string): boolean {
  for (const char of text) {
    if (isBengaliCodePoint(char.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

export type ScriptRun = {
  text: string;
  bengali: boolean;
};

/**
 * Splits mixed Latin/Bengali text into runs. Whitespace stays with the
 * preceding run so spaces inside a Bengali name keep the Bengali font.
 */
export function splitScriptRuns(text: string): ScriptRun[] {
  const runs: ScriptRun[] = [];
  let current: ScriptRun | null = null;

  for (const char of text) {
    const isSpace = /\s/.test(char);
    let bengali = false;
    if (isSpace) {
      bengali = current !== null && current.bengali;
    } else {
      bengali = isBengaliCodePoint(char.codePointAt(0) ?? 0);
    }

    if (!current || current.bengali !== bengali) {
      current = { text: char, bengali };
      runs.push(current);
    } else {
      current.text += char;
    }
  }

  return runs;
}

export function formatTitle(template: string, monthName: string, year: number): string {
  return template.replace(/\{Month\}/g, monthName).replace(/\{Year\}/g, String(year));
}

export function buildSheet(input: {
  month: number;
  year: number;
  teachers: TeacherListItem[];
  settings: AppSettings;
}): SheetData {
  const { month, year, teachers, settings } = input;
  const monthName = MONTHS[month - 1] ?? MONTHS[0];
  const days = daysInMonth(year, month);
  const pageCount = Math.max(1, Math.ceil(teachers.length / 3));
  const pages: SheetSlot[][] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page: SheetSlot[] = [];
    for (let slot = 0; slot < 3; slot += 1) {
      const index = pageIndex * 3 + slot;
      const teacher = teachers[index];
      page.push(
        teacher
          ? { serial: index + 1, name: teacher.name, empty: false }
          : { serial: index + 1, name: "", empty: true }
      );
    }
    pages.push(page);
  }

  return {
    month,
    year,
    monthName,
    days,
    title: formatTitle(settings.titleTemplate, monthName, year),
    schoolName: settings.schoolName,
    fillEmptySlots: settings.fillEmptySlots,
    zebra: settings.zebra,
    pages,
    teacherCount: teachers.length
  };
}

export function sheetFileName(sheet: Pick<SheetData, "monthName" | "year">, extension: string): string {
  return `Teachers-Attendance-${sheet.monthName}-${sheet.year}.${extension}`;
}
