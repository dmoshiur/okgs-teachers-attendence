import type { AppSettings } from "./settings";
import type { TeacherListItem } from "./teachers";
import type { IncludeFilter } from "./validation";

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

/** Points per centimetre. */
export const CM = 28.3464567;

/** Sheet geometry copied from the reference DOCX (twips converted to points). */
export const PAGE_WIDTH = 595.28; // A4 width in points
export const PAGE_HEIGHT = 841.89; // A4 height in points

/**
 * The page border sits 0.5 in (1.27 cm) from every paper edge. Printers cannot
 * reach the edge of the sheet, so a border drawn at 6 pt — as in the reference
 * document — is clipped by most devices.
 */
export const BORDER_OFFSET = 36; // 0.5 in from the page edge
export const BORDER_STEP = 3; // gap between the three lines
export const BORDER_WIDTH = 1.5;
export const BORDER_LINES = [0, 1, 2] as const;

/**
 * Content starts here, 18 pt (0.63 cm) inside the innermost border line, which
 * is comfortably clear of the 0.3 cm minimum and leaves room for the table.
 */
export const CONTENT_MARGIN = 54;

export const TABLE_WIDTH_TWIPS = 9745;
export const TABLE_WIDTH = TABLE_WIDTH_TWIPS / 20; // 487.25 pt
export const TABLE_LEFT = (PAGE_WIDTH - TABLE_WIDTH) / 2;

/**
 * Same proportions as the reference document (9952 twips), scaled uniformly so
 * the table fits inside the new border: 9952 → 9745 twips.
 */
export const COLUMN_WIDTHS_TWIPS = [619, 864, 1175, 1011, 972, 1084, 1022, 845, 1120, 1033] as const;
export const COLUMN_WIDTHS = COLUMN_WIDTHS_TWIPS.map((width) => width / 20);

export const NAME_ROW_HEIGHT = 314 / 20; // 15.7 pt
export const NAME_ROW_HEIGHT_BENGALI = 18.5;
export const HEADER_ROW_HEIGHT = 20;
/** 0.65 cm, inside the 0.62–0.68 cm band that keeps 31 days on one page. */
export const DAY_ROW_HEIGHT = 18.4;
export const DAY_ROW_HEIGHT_TWIPS = Math.round(DAY_ROW_HEIGHT * 20); // 368
export const EMPTY_PARAGRAPH_HEIGHT = 13.4;
export const TINOS_LINE_HEIGHT_RATIO = 1.15;
export const BENGALI_LINE_HEIGHT_RATIO = 1.594;
export const DESIGNATION_FONT_SIZE = 9;
export const DESIGNATION_LINE_HEIGHT = 11;
export const DESIGNATION_LINE_HEIGHT_BENGALI = 14.5;

export type SheetSlot = {
  serial: number;
  name: string;
  designation: string;
  empty: boolean;
};

export type PageLayout = {
  schoolLineHeight: number;
  titleTop: number;
  titleLineHeight: number;
  headerBottom: number;
  tableTop: number;
  nameRowHeight: number;
  tableHeight: number;
  tableBottom: number;
  contentBottom: number;
  fits: boolean;
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
  showDesignation: boolean;
  pages: SheetSlot[][];
  teacherCount: number;
  layout: PageLayout;
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

export function nameRowHeightFor(slots: SheetSlot[], showDesignation: boolean): number {
  const bengali = slots.some((slot) => slot.name.length > 0 && containsBengali(slot.name));
  const base = bengali ? NAME_ROW_HEIGHT_BENGALI : NAME_ROW_HEIGHT;
  const designation = slots.find((slot) => showDesignation && slot.designation.length > 0);
  if (!designation) return base;
  return base + (containsBengali(designation.designation) ? DESIGNATION_LINE_HEIGHT_BENGALI : DESIGNATION_LINE_HEIGHT);
}

/**
 * Vertical layout shared by the PDF and DOCX renderers, so both put the border,
 * the heading and the table in the same place.
 */
export function computePageLayout(input: {
  schoolName: string;
  title: string;
  days: number;
  pages: SheetSlot[][];
  showDesignation: boolean;
}): PageLayout {
  const schoolLineHeight =
    23 * (containsBengali(input.schoolName) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO);
  const titleTop = CONTENT_MARGIN + schoolLineHeight + 10;
  const titleLineHeight =
    15 * (containsBengali(input.title) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO);
  const headerBottom = titleTop + titleLineHeight + 2 * EMPTY_PARAGRAPH_HEIGHT;
  const tableTop = headerBottom + EMPTY_PARAGRAPH_HEIGHT;

  const nameRowHeight = input.pages.reduce(
    (tallest, page) => Math.max(tallest, nameRowHeightFor(page, input.showDesignation)),
    NAME_ROW_HEIGHT
  );
  const tableHeight = nameRowHeight + HEADER_ROW_HEIGHT + input.days * DAY_ROW_HEIGHT;
  const tableBottom = tableTop + tableHeight;
  const contentBottom = PAGE_HEIGHT - CONTENT_MARGIN;

  return {
    schoolLineHeight,
    titleTop,
    titleLineHeight,
    headerBottom,
    tableTop,
    nameRowHeight,
    tableHeight,
    tableBottom,
    contentBottom,
    fits: tableBottom <= contentBottom
  };
}

export function buildSheet(input: {
  month: number;
  year: number;
  teachers: TeacherListItem[];
  settings: AppSettings;
  include: IncludeFilter;
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
          ? {
              serial: index + 1,
              name: teacher.name,
              designation: teacher.designation ?? "",
              empty: false
            }
          : { serial: index + 1, name: "", designation: "", empty: true }
      );
    }
    pages.push(page);
  }

  const layout = computePageLayout({
    schoolName: settings.schoolName,
    title: formatTitle(settings.titleTemplate, monthName, year),
    days,
    pages,
    showDesignation: settings.showDesignation
  });

  if (!layout.fits) {
    console.warn(
      `[sheet] the table is ${layout.tableBottom.toFixed(1)} pt tall and ends at ` +
        `${layout.tableBottom.toFixed(1)} pt, past the content area (${layout.contentBottom.toFixed(1)} pt).`
    );
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
    showDesignation: settings.showDesignation,
    pages,
    teacherCount: teachers.length,
    layout
  };
}

export function sheetFileName(sheet: Pick<SheetData, "monthName" | "year">, extension: string): string {
  return `Teachers-Attendance-${sheet.monthName}-${sheet.year}.${extension}`;
}
