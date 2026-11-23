import "server-only";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  Text,
  View,
  renderToBuffer
} from "@react-pdf/renderer";
import {
  BENGALI_LINE_HEIGHT_RATIO,
  BORDER_LINES,
  BORDER_OFFSET,
  BORDER_STEP,
  BORDER_WIDTH,
  CM,
  COLUMN_WIDTHS,
  CONTENT_MARGIN,
  DAY_ROW_HEIGHT,
  DESIGNATION_FONT_SIZE,
  HEADER_ROW_HEIGHT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  TABLE_LEFT,
  TABLE_WIDTH,
  TINOS_LINE_HEIGHT_RATIO,
  containsBengali,
  nameRowHeightFor,
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
const FONT_FILES = [
  "Tinos-Regular.ttf",
  "Tinos-Bold.ttf",
  "NotoSerifBengali-Regular.ttf",
  "NotoSerifBengali-Bold.ttf"
] as const;

let fontsRegistered = false;

function assertFontsPresent(): void {
  const missing = FONT_FILES.filter((file) => !fs.existsSync(path.join(FONT_DIR, file)));
  if (missing.length > 0) {
    throw new Error(
      `Bundled fonts are missing from the server bundle (${missing.join(", ")}). ` +
        `Looked in ${FONT_DIR}. Check outputFileTracingIncludes in next.config.ts.`
    );
  }
}

function registerFonts() {
  if (fontsRegistered) return;
  assertFontsPresent();
  Font.register({
    family: "Tinos",
    fonts: [
      { src: path.join(FONT_DIR, "Tinos-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Tinos-Bold.ttf"), fontWeight: 700 }
    ]
  });
  Font.register({
    family: "NotoSerifBengali",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSerifBengali-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "NotoSerifBengali-Bold.ttf"), fontWeight: 700 }
    ]
  });
  fontsRegistered = true;
}

type TextStyle = Record<string, string | number>;

/**
 * `style` on @react-pdf's `<Text>` is typed as a union that also covers SVG
 * presentation attributes, which TypeScript cannot narrow from a plain record.
 * Every value used here is a plain layout value, so the cast is safe.
 */
function asStyle(style: TextStyle) {
  return style as never;
}

type RichTextProps = {
  text: string;
  fontSize: number;
  bold?: boolean;
  lineHeight?: number;
  style?: TextStyle;
};

function RichText({ text, fontSize, bold = false, lineHeight, style = {} }: RichTextProps) {
  const runs = splitScriptRuns(text);
  const outerStyle: TextStyle = {
    fontFamily: "Tinos",
    fontSize,
    fontWeight: bold ? 700 : 400,
    ...(lineHeight ? { lineHeight } : {}),
    ...(style ?? {})
  };

  return (
    <Text style={asStyle(outerStyle)}>
      {runs.map((run, index) => (
        <Text
          key={`${index}-${run.bengali ? "bn" : "en"}`}
          style={{
            fontFamily: run.bengali ? "NotoSerifBengali" : "Tinos",
            fontWeight: bold ? 700 : 400
          }}
        >
          {run.text}
        </Text>
      ))}
    </Text>
  );
}

type CellTextProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  align?: "left" | "center";
  fontSize?: number;
  bold?: boolean;
  lineHeightRatio?: number;
  pad?: number;
};

function CellText({
  x,
  y,
  width,
  height,
  text,
  align = "center",
  fontSize = 11,
  bold = false,
  lineHeightRatio = TINOS_LINE_HEIGHT_RATIO,
  pad = 5.4
}: CellTextProps) {
  const lineHeight = fontSize * lineHeightRatio;
  const top = y + (height - lineHeight) / 2;
  const left = align === "left" ? x + pad : x;
  const availableWidth = align === "left" ? width - pad : width;

  return (
    <RichText
      text={text}
      fontSize={fontSize}
      bold={bold}
      lineHeight={lineHeightRatio}
      style={asStyle({
        position: "absolute",
        top,
        left,
        width: availableWidth,
        textAlign: align
      })}
    />
  );
}

/**
 * Three concentric 1.5 pt lines, the outermost 0.5 in in from the paper edge.
 * Drawn inside the printable area of every A4 printer.
 */
function PageBorder() {
  return (
    <>
      {BORDER_LINES.map((line) => {
        const offset = BORDER_OFFSET + line * BORDER_STEP;
        return (
          <View
            key={offset}
            style={{
              position: "absolute",
              top: offset,
              left: offset,
              width: PAGE_WIDTH - offset * 2,
              height: PAGE_HEIGHT - offset * 2,
              borderWidth: BORDER_WIDTH,
              borderColor: "#000000"
            }}
          />
        );
      })}
    </>
  );
}

function Header({ sheet, logo }: { sheet: SheetData; logo: PngLogo | null }) {
  const layout = sheet.layout;
  const boxWidth = 2.2 * CM;
  const boxHeight = 2.5 * CM;
  const scale = logo ? Math.min(boxWidth / logo.width, boxHeight / logo.height) : 0;
  const logoWidth = logo ? logo.width * scale : 0;
  const logoHeight = logo ? logo.height * scale : 0;

  return (
    <>
      {logo ? (
        <View
          style={{
            position: "absolute",
            top: CONTENT_MARGIN + 0.056 * CM,
            left: CONTENT_MARGIN + 0.75 * CM,
            width: logoWidth,
            height: logoHeight
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
          <Image src={logo.data} style={{ width: logoWidth, height: logoHeight }} />
        </View>
      ) : null}
      <RichText
        text={sheet.schoolName}
        fontSize={23}
        bold
        lineHeight={containsBengali(sheet.schoolName) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO}
        style={{
          position: "absolute",
          top: CONTENT_MARGIN,
          left: CONTENT_MARGIN,
          right: CONTENT_MARGIN,
          textAlign: "center"
        }}
      />
      <RichText
        text={sheet.title}
        fontSize={15}
        lineHeight={containsBengali(sheet.title) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO}
        style={{
          position: "absolute",
          top: layout.titleTop,
          left: CONTENT_MARGIN,
          right: CONTENT_MARGIN,
          textAlign: "center"
        }}
      />
    </>
  );
}

function SheetTable({ pageTeachers, sheet }: { pageTeachers: SheetSlot[]; sheet: SheetData }) {
  const layout = sheet.layout;
  const nameHeight = layout.nameRowHeight;
  const baseNameHeight = nameRowHeightFor(pageTeachers, false);
  const designationHeight = nameHeight - baseNameHeight;
  const rowHeights = [nameHeight, HEADER_ROW_HEIGHT, ...Array<number>(sheet.days).fill(DAY_ROW_HEIGHT)];
  const totalHeight = rowHeights.reduce((total, height) => total + height, 0);
  const children: React.ReactNode[] = [];

  if (sheet.zebra) {
    let top = nameHeight + HEADER_ROW_HEIGHT;
    for (let day = 1; day <= sheet.days; day += 1) {
      if (day % 2 === 0) {
        children.push(
          <View
            key={`zebra-${day}`}
            style={{
              position: "absolute",
              left: 0,
              top,
              width: TABLE_WIDTH,
              height: DAY_ROW_HEIGHT,
              backgroundColor: "#D9D9D9"
            }}
          />
        );
      }
      top += DAY_ROW_HEIGHT;
    }
  }

  children.push(
    <View
      key="header-fill"
      style={{
        position: "absolute",
        left: 0,
        top: nameHeight,
        width: TABLE_WIDTH,
        height: HEADER_ROW_HEIGHT,
        backgroundColor: "#D9D9D9"
      }}
    />
  );

  // Column edges. In the name row the three name cells each span three
  // columns, so only the group edges are drawn there; the full grid starts
  // below it, exactly like the merged cells of the reference document.
  const edges: number[] = [];
  let x = 0;
  edges.push(0);
  for (const width of COLUMN_WIDTHS) {
    x += width;
    edges.push(x);
  }
  const nameRowEdges = new Set([0, 1, 4, 7, 10].map((index) => edges[index]));

  edges.forEach((edge, index) => {
    if (nameRowEdges.has(edge)) {
      children.push(
        <View
          key={`v-${index}`}
          style={{
            position: "absolute",
            left: edge - 0.25,
            top: 0,
            width: 0.5,
            height: totalHeight,
            backgroundColor: "#000000"
          }}
        />
      );
    } else {
      children.push(
        <View
          key={`v-${index}`}
          style={{
            position: "absolute",
            left: edge - 0.25,
            top: nameHeight,
            width: 0.5,
            height: totalHeight - nameHeight,
            backgroundColor: "#000000"
          }}
        />
      );
    }
  });

  let y = 0;
  for (let index = 0; index <= rowHeights.length; index += 1) {
    children.push(
      <View
        key={`h-${index}`}
        style={{
          position: "absolute",
          left: 0,
          top: y - 0.25,
          width: TABLE_WIDTH,
          height: 0.5,
          backgroundColor: "#000000"
        }}
      />
    );
    if (index < rowHeights.length) y += rowHeights[index];
  }

  const headers = ["Date", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out", "Sign In", "Signature", "Sign Out"];
  let headerX = 0;
  headers.forEach((header, index) => {
    children.push(
      <CellText
        key={`header-${index}`}
        x={headerX}
        y={nameHeight}
        width={COLUMN_WIDTHS[index]}
        height={HEADER_ROW_HEIGHT}
        text={header}
      />
    );
    headerX += COLUMN_WIDTHS[index];
  });

  const nameCells = [
    { x: COLUMN_WIDTHS[0], width: COLUMN_WIDTHS[1] + COLUMN_WIDTHS[2] + COLUMN_WIDTHS[3] },
    {
      x: COLUMN_WIDTHS[0] + COLUMN_WIDTHS[1] + COLUMN_WIDTHS[2] + COLUMN_WIDTHS[3],
      width: COLUMN_WIDTHS[4] + COLUMN_WIDTHS[5] + COLUMN_WIDTHS[6]
    },
    {
      x: COLUMN_WIDTHS[0] +
        COLUMN_WIDTHS[1] +
        COLUMN_WIDTHS[2] +
        COLUMN_WIDTHS[3] +
        COLUMN_WIDTHS[4] +
        COLUMN_WIDTHS[5] +
        COLUMN_WIDTHS[6],
      width: COLUMN_WIDTHS[7] + COLUMN_WIDTHS[8] + COLUMN_WIDTHS[9]
    }
  ];

  pageTeachers.forEach((slot, index) => {
    const label = slot.empty
      ? sheet.fillEmptySlots
        ? `${slot.serial}.`
        : ""
      : `${slot.serial}. ${slot.name}`;
    if (!label) return;

    const lineHeightRatio = containsBengali(label) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO;
    children.push(
      <CellText
        key={`name-${index}`}
        x={nameCells[index].x}
        y={0}
        width={nameCells[index].width}
        height={baseNameHeight}
        text={label}
        align="left"
        lineHeightRatio={lineHeightRatio}
      />
    );

    // Only when the setting is on; otherwise the cell stays "N. Name".
    if (sheet.showDesignation && slot.designation) {
      children.push(
        <CellText
          key={`designation-${index}`}
          x={nameCells[index].x}
          y={baseNameHeight}
          width={nameCells[index].width}
          height={designationHeight}
          text={slot.designation}
          align="left"
          fontSize={DESIGNATION_FONT_SIZE}
          lineHeightRatio={containsBengali(slot.designation) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO}
        />
      );
    }
  });

  for (let day = 1; day <= sheet.days; day += 1) {
    children.push(
      <CellText
        key={`day-${day}`}
        x={0}
        y={nameHeight + HEADER_ROW_HEIGHT + (day - 1) * DAY_ROW_HEIGHT}
        width={COLUMN_WIDTHS[0]}
        height={DAY_ROW_HEIGHT}
        text={String(day)}
      />
    );
  }

  return (
    <View
      style={{
        position: "absolute",
        left: TABLE_LEFT,
        top: layout.tableTop,
        width: TABLE_WIDTH,
        height: totalHeight
      }}
    >
      {children}
    </View>
  );
}

function AttendanceDocument({ sheet, logo }: { sheet: SheetData; logo: PngLogo | null }) {
  return (
    <Document
      title={sheet.title}
      author={sheet.schoolName}
      subject="Teachers Attendance Sheet"
      creator="Teacher Attendance Sheet Generator"
    >
      {sheet.pages.map((pageTeachers, index) => (
        <Page key={index} size="A4" style={{ position: "relative" }}>
          <PageBorder />
          <Header sheet={sheet} logo={logo} />
          <SheetTable pageTeachers={pageTeachers} sheet={sheet} />
        </Page>
      ))}
    </Document>
  );
}

export async function renderAttendancePdf(
  sheet: SheetData,
  logo: PngLogo | null
): Promise<Buffer> {
  registerFonts();
  const buffer = await renderToBuffer(<AttendanceDocument sheet={sheet} logo={logo} />);
  return Buffer.from(buffer);
}
