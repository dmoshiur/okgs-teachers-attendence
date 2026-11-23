import "server-only";
import React from "react";
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
  COLUMN_WIDTHS,
  DAY_ROW_HEIGHT,
  EMPTY_PARAGRAPH_HEIGHT,
  HEADER_ROW_HEIGHT,
  HEADER_TOP,
  NAME_ROW_HEIGHT,
  NAME_ROW_HEIGHT_BENGALI,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  TABLE_LEFT,
  TABLE_WIDTH,
  TINOS_LINE_HEIGHT_RATIO,
  containsBengali,
  splitScriptRuns,
  type SheetData,
  type SheetSlot
} from "./sheet";
import type { PngLogo } from "./logo";

const FONT_DIR = path.join(process.cwd(), "src", "assets", "fonts");
const CM = 28.3464567;

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
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

function PageBorder() {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT
      }}
    >
      {[6, 9, 12].map((offset) => (
        <View
          key={offset}
          style={{
            position: "absolute",
            top: offset,
            left: offset,
            right: offset,
            bottom: offset,
            borderWidth: 1.5,
            borderColor: "#000000"
          }}
        />
      ))}
    </View>
  );
}

type Layout = {
  schoolLineHeight: number;
  titleTop: number;
  titleLineHeight: number;
  headerBottom: number;
  tableTop: number;
};

function computeLayout(sheet: SheetData): Layout {
  const schoolLineHeight =
    23 * (containsBengali(sheet.schoolName) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO);
  const titleTop = HEADER_TOP + schoolLineHeight + 10;
  const titleLineHeight =
    15 * (containsBengali(sheet.title) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO);
  const headerBottom = titleTop + titleLineHeight + 2 * EMPTY_PARAGRAPH_HEIGHT;
  const tableTop = headerBottom + EMPTY_PARAGRAPH_HEIGHT;
  return { schoolLineHeight, titleTop, titleLineHeight, headerBottom, tableTop };
}

function Header({
  sheet,
  logo,
  layout
}: {
  sheet: SheetData;
  logo: PngLogo;
  layout: Layout;
}) {
  const boxWidth = 2.2 * CM;
  const boxHeight = 2.5 * CM;
  const scale = Math.min(boxWidth / logo.width, boxHeight / logo.height);
  const logoWidth = logo.width * scale;
  const logoHeight = logo.height * scale;

  return (
    <>
      <View
        style={{
          position: "absolute",
          top: HEADER_TOP + 0.056 * CM,
          left: PAGE_MARGIN + 0.75 * CM,
          width: logoWidth,
          height: logoHeight
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
        <Image src={logo.data} style={{ width: logoWidth, height: logoHeight }} />
      </View>
      <RichText
        text={sheet.schoolName}
        fontSize={23}
        bold
        lineHeight={containsBengali(sheet.schoolName) ? BENGALI_LINE_HEIGHT_RATIO : TINOS_LINE_HEIGHT_RATIO}
        style={{
          position: "absolute",
          top: HEADER_TOP,
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
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
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
          textAlign: "center"
        }}
      />
    </>
  );
}

function SheetTable({
  pageTeachers,
  sheet,
  tableTop
}: {
  pageTeachers: SheetSlot[];
  sheet: SheetData;
  tableTop: number;
}) {
  const nameHeight = pageTeachers.some((slot) => slot.name && containsBengali(slot.name))
    ? NAME_ROW_HEIGHT_BENGALI
    : NAME_ROW_HEIGHT;
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
        height={nameHeight}
        text={label}
        align="left"
        lineHeightRatio={lineHeightRatio}
      />
    );
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
        top: tableTop,
        width: TABLE_WIDTH,
        height: totalHeight
      }}
    >
      {children}
    </View>
  );
}

function AttendanceDocument({ sheet, logo }: { sheet: SheetData; logo: PngLogo }) {
  const layout = computeLayout(sheet);

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
          <Header sheet={sheet} logo={logo} layout={layout} />
          <SheetTable pageTeachers={pageTeachers} sheet={sheet} tableTop={layout.tableTop} />
        </Page>
      ))}
    </Document>
  );
}

export async function renderAttendancePdf(sheet: SheetData, logo: PngLogo): Promise<Buffer> {
  registerFonts();
  const buffer = await renderToBuffer(<AttendanceDocument sheet={sheet} logo={logo} />);
  return Buffer.from(buffer);
}
