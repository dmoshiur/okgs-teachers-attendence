import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LineRuleType,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalAlign,
  VerticalPositionRelativeFrom,
  WidthType
} from "docx";
import {
  COLUMN_WIDTHS_TWIPS,
  CONTENT_MARGIN,
  DAY_ROW_HEIGHT_TWIPS,
  DESIGNATION_FONT_SIZE,
  HEADER_ROW_HEIGHT,
  TABLE_WIDTH_TWIPS,
  splitScriptRuns,
  type SheetData,
  type SheetSlot
} from "./sheet";
import type { PngLogo } from "./logo";

/**
 * Static .ttf files shipped in the repository and copied into the serverless
 * bundle by `outputFileTracingIncludes` in next.config.ts. They are resolved
 * from `process.cwd()`, which is the function root on Vercel.
 */
const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");

type FontBuffers = {
  tinosRegular: Buffer;
  tinosBold: Buffer;
  bengaliRegular: Buffer;
  bengaliBold: Buffer;
};

const FONT_FILES: Array<{ key: keyof FontBuffers; file: string }> = [
  { key: "tinosRegular", file: "Tinos-Regular.ttf" },
  { key: "tinosBold", file: "Tinos-Bold.ttf" },
  { key: "bengaliRegular", file: "NotoSerifBengali-Regular.ttf" },
  { key: "bengaliBold", file: "NotoSerifBengali-Bold.ttf" }
];

let fontBuffers: FontBuffers | null = null;

function getFontBuffers(): FontBuffers {
  if (fontBuffers) return fontBuffers;

  const missing = FONT_FILES.filter((entry) => !fs.existsSync(path.join(FONT_DIR, entry.file)));
  if (missing.length > 0) {
    throw new Error(
      `Bundled fonts are missing from the server bundle (${missing
        .map((entry) => entry.file)
        .join(", ")}). Looked in ${FONT_DIR}. Check outputFileTracingIncludes in next.config.ts.`
    );
  }

  fontBuffers = {} as FontBuffers;
  for (const entry of FONT_FILES) {
    fontBuffers[entry.key] = fs.readFileSync(path.join(FONT_DIR, entry.file));
  }
  return fontBuffers;
}

const FONT_TINOS = {
  ascii: "Tinos",
  hAnsi: "Tinos",
  eastAsia: "Tinos",
  cs: "Tinos"
};

const FONT_BENGALI = {
  ascii: "Noto Serif Bengali",
  hAnsi: "Noto Serif Bengali",
  eastAsia: "Noto Serif Bengali",
  cs: "Noto Serif Bengali"
};

function makeRuns(text: string, sizeHalfPoints: number, bold = false): TextRun[] {
  return splitScriptRuns(text).map(
    (run) =>
      new TextRun({
        text: run.text,
        bold,
        size: sizeHalfPoints,
        font: run.bengali ? FONT_BENGALI : FONT_TINOS
      })
  );
}

function emptyParagraph(options: { pageBreakBefore?: boolean; keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
    run: { font: "Tinos", size: 22 },
    pageBreakBefore: options.pageBreakBefore,
    keepNext: options.keepNext,
    children: []
  });
}

function cellParagraph(options: {
  text?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  bold?: boolean;
  keepNext?: boolean;
  size?: number;
}): Paragraph {
  const { text = "", align = AlignmentType.CENTER, bold = false, keepNext = true, size = 22 } = options;
  return new Paragraph({
    alignment: align,
    // Single spacing plus an explicit row height keeps the 31 day rows at
    // exactly the height the layout expects (see DAY_ROW_HEIGHT_TWIPS).
    spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
    keepNext,
    children: text ? makeRuns(text, size, bold) : []
  });
}

function shadedCell(options: {
  width: number;
  columnSpan?: number;
  fill?: string;
  children: Paragraph[];
}): TableCell {
  return new TableCell({
    width: { size: options.width, type: WidthType.DXA },
    columnSpan: options.columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: options.fill
      ? { type: ShadingType.CLEAR, color: "auto", fill: options.fill }
      : undefined,
    children: options.children
  });
}

function buildNameRow(pageTeachers: SheetSlot[], sheet: SheetData, keepNext: boolean): TableRow {
  const widths = [3114, 3144, 3062];
  const nameHeight = sheet.layout.nameRowHeight;
  const showDesignation = sheet.showDesignation;

  const cells: TableCell[] = [
    shadedCell({
      width: COLUMN_WIDTHS_TWIPS[0],
      children: [cellParagraph({ keepNext })]
    })
  ];

  pageTeachers.forEach((slot, index) => {
    const label = slot.empty
      ? sheet.fillEmptySlots
        ? `${slot.serial}.`
        : ""
      : `${slot.serial}. ${slot.name}`;

    const children: Paragraph[] = [
      new Paragraph({
        spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
        keepNext,
        children: label ? makeRuns(label, 22) : []
      })
    ];

    // Only when the setting is on; otherwise the cell stays "N. Name".
    if (showDesignation && slot.designation) {
      children.push(
        new Paragraph({
          spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
          keepNext: false,
          children: makeRuns(slot.designation, DESIGNATION_FONT_SIZE * 2)
        })
      );
    }

    cells.push(
      shadedCell({
        width: widths[index],
        columnSpan: 3,
        children
      })
    );
  });

  return new TableRow({
    cantSplit: true,
    keepNext,
    height: { value: Math.round(nameHeight * 20), rule: HeightRule.ATLEAST },
    children: cells
  });
}

function buildHeaderRow(keepNext: boolean): TableRow {
  const headers = ["Date", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out"];
  return new TableRow({
    cantSplit: true,
    keepNext,
    height: { value: Math.round(HEADER_ROW_HEIGHT * 20), rule: HeightRule.ATLEAST },
    children: headers.map(
      (header, index) =>
        new TableCell({
          width: { size: COLUMN_WIDTHS_TWIPS[index], type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9D9D9" },
          children: [cellParagraph({ text: header, keepNext })]
        })
    )
  });
}

function buildDayRow(day: number, sheet: SheetData, keepNext: boolean): TableRow {
  const fill = sheet.zebra && day % 2 === 0 ? "D9D9D9" : undefined;
  const cells: TableCell[] = [
    shadedCell({
      width: COLUMN_WIDTHS_TWIPS[0],
      fill,
      children: [cellParagraph({ text: String(day), keepNext })]
    })
  ];

  for (let index = 1; index < COLUMN_WIDTHS_TWIPS.length; index += 1) {
    cells.push(
      shadedCell({
        width: COLUMN_WIDTHS_TWIPS[index],
        fill,
        children: [cellParagraph({ keepNext })]
      })
    );
  }

  return new TableRow({
    cantSplit: true,
    keepNext,
    height: { value: DAY_ROW_HEIGHT_TWIPS, rule: HeightRule.ATLEAST },
    children: cells
  });
}

function buildTable(pageTeachers: SheetSlot[], sheet: SheetData): Table {
  const rows: TableRow[] = [];
  rows.push(buildNameRow(pageTeachers, sheet, true));
  rows.push(buildHeaderRow(true));

  for (let day = 1; day <= sheet.days; day += 1) {
    rows.push(buildDayRow(day, sheet, day < sheet.days));
  }

  return new Table({
    width: { size: TABLE_WIDTH_TWIPS, type: WidthType.DXA },
    columnWidths: [...COLUMN_WIDTHS_TWIPS],
    layout: TableLayoutType.FIXED,
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
    },
    margins: { top: 0, bottom: 0, left: 108, right: 108 },
    rows
  });
}

/**
 * The heading lives in the body, not in a Word header, on every page.
 *
 * Word expands the text area downwards when a header is taller than the space
 * above the top margin, and the page border is measured from that text area —
 * so a header would move the border away from the intended 0.5 in. Keeping the
 * heading in the body makes both the border position and the table position
 * exact.
 */
function buildHeading(sheet: SheetData, logo: PngLogo | null): Paragraph[] {
  const boxWidthPx = (2.2 / 2.54) * 96;
  const boxHeightPx = (2.5 / 2.54) * 96;
  const scale = logo ? Math.min(boxWidthPx / logo.width, boxHeightPx / logo.height) : 0;
  const imageWidth = logo ? Math.max(1, Math.round(logo.width * scale)) : 0;
  const imageHeight = logo ? Math.max(1, Math.round(logo.height * scale)) : 0;

  const schoolParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, line: 276, lineRule: LineRuleType.AUTO },
    keepNext: true,
    children: [
      ...makeRuns(sheet.schoolName, 46, true),
      ...(logo
        ? [
            new ImageRun({
              type: "png",
              data: logo.data,
              transformation: { width: imageWidth, height: imageHeight },
              floating: {
                horizontalPosition: {
                  relative: HorizontalPositionRelativeFrom.COLUMN,
                  offset: 270000
                },
                verticalPosition: {
                  relative: VerticalPositionRelativeFrom.PARAGRAPH,
                  offset: 20320
                },
                behindDocument: true,
                allowOverlap: true,
                wrap: { type: TextWrappingType.NONE }
              }
            })
          ]
        : [])
    ]
  });

  return [
    schoolParagraph,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
      keepNext: true,
      children: makeRuns(sheet.title, 30)
    }),
    emptyParagraph({ keepNext: true }),
    emptyParagraph({ keepNext: true })
  ];
}

function buildDocument(sheet: SheetData, logo: PngLogo | null): Document {
  const fonts = getFontBuffers();
  const body: Array<Paragraph | Table> = [];

  sheet.pages.forEach((pageTeachers, index) => {
    if (index > 0) body.push(emptyParagraph({ pageBreakBefore: true, keepNext: true }));
    body.push(...buildHeading(sheet, logo));
    body.push(buildTable(pageTeachers, sheet));
  });

  body.push(emptyParagraph());

  // 1080 twips = 54 pt (0.75 in). The border is drawn 18 pt outside the text
  // area (offsetFrom TEXT), which puts its outer line at 36 pt = 0.5 in from
  // every paper edge, and leaves 0.63 cm of clear space around the content.
  const MARGIN_TWIPS = Math.round(CONTENT_MARGIN * 20);
  const BORDER_SPACE = Math.round(CONTENT_MARGIN - 36);

  return new Document({
    fonts: [
      { name: "Tinos", data: fonts.tinosRegular, bold: fonts.tinosBold },
      { name: "Noto Serif Bengali", data: fonts.bengaliRegular, bold: fonts.bengaliBold }
    ],
    styles: {
      default: {
        document: {
          run: { font: "Tinos", size: 22 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11907, height: 16839 },
            margin: {
              top: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              header: MARGIN_TWIPS,
              footer: 720,
              gutter: 0
            },
            pageNumbers: { start: 1 },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.TEXT
              },
              pageBorderTop: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: BORDER_SPACE },
              pageBorderLeft: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: BORDER_SPACE },
              pageBorderBottom: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: BORDER_SPACE },
              pageBorderRight: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: BORDER_SPACE }
            }
          },
          grid: { linePitch: 0, charSpace: 0 }
        },
        children: body
      }
    ]
  });
}

export async function renderAttendanceDocx(
  sheet: SheetData,
  logo: PngLogo | null
): Promise<Buffer> {
  const document = buildDocument(sheet, logo);
  const buffer = await Packer.toBuffer(document);
  return Buffer.from(buffer);
}
