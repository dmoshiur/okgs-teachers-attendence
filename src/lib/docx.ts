import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
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
  NAME_ROW_HEIGHT,
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
    spacing: { after: 0, line: 380, lineRule: LineRuleType.AUTO },
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
    cells.push(
      shadedCell({
        width: widths[index],
        columnSpan: 3,
        children: [
          new Paragraph({
            spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
            keepNext,
            children: label ? makeRuns(label, 22) : []
          })
        ]
      })
    );
  });

  return new TableRow({
    cantSplit: true,
    keepNext,
    height: { value: Math.round(NAME_ROW_HEIGHT * 20), rule: HeightRule.ATLEAST },
    children: cells
  });
}

function buildHeaderRow(keepNext: boolean): TableRow {
  const headers = ["Date", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out"];
  return new TableRow({
    cantSplit: true,
    keepNext,
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

  return new TableRow({ cantSplit: true, keepNext, children: cells });
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

function buildHeader(sheet: SheetData, logo: PngLogo | null): Header {
  const boxWidthPx = (2.2 / 2.54) * 96;
  const boxHeightPx = (2.5 / 2.54) * 96;
  const scale = logo ? Math.min(boxWidthPx / logo.width, boxHeightPx / logo.height) : 0;
  const imageWidth = logo ? Math.max(1, Math.round(logo.width * scale)) : 0;
  const imageHeight = logo ? Math.max(1, Math.round(logo.height * scale)) : 0;

  const schoolNameRuns = makeRuns(sheet.schoolName, 46, true);
  const titleRuns = makeRuns(sheet.title, 30);

  const headerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, line: 276, lineRule: LineRuleType.AUTO },
    children: [
      ...schoolNameRuns,
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

  return new Header({
    children: [
      headerParagraph,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
        children: titleRuns
      }),
      emptyParagraph(),
      emptyParagraph()
    ]
  });
}

function buildDocument(sheet: SheetData, logo: PngLogo | null): Document {
  const fonts = getFontBuffers();
  const body: Array<Paragraph | Table> = [emptyParagraph({ keepNext: true })];

  sheet.pages.forEach((pageTeachers, index) => {
    if (index > 0) body.push(emptyParagraph({ pageBreakBefore: true, keepNext: true }));
    body.push(buildTable(pageTeachers, sheet));
  });

  body.push(emptyParagraph());

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
            margin: { top: 360, right: 360, bottom: 360, left: 360, header: 720, footer: 720, gutter: 0 },
            pageNumbers: { start: 1 },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.PAGE
              },
              pageBorderTop: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: 6 },
              pageBorderLeft: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: 6 },
              pageBorderBottom: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: 6 },
              pageBorderRight: { style: BorderStyle.TRIPLE, size: 12, color: "000000", space: 6 }
            }
          },
          grid: { linePitch: 0, charSpace: 0 }
        },
        headers: { default: buildHeader(sheet, logo) },
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
