"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileDown,
  Info,
  Printer,
  RefreshCw,
  Users
} from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { MONTHS, daysInMonth } from "@/lib/sheet";
import type { AppSettings } from "@/lib/settings";

type ActionKind = "pdf" | "docx" | "print";

const YEARS = Array.from({ length: 111 }, (_, index) => 1990 + index);

export function GeneratorClient({
  initialTeacherCount,
  initialMonth,
  initialYear,
  settings
}: {
  initialTeacherCount: number;
  initialMonth: number;
  initialYear: number;
  settings: Pick<AppSettings, "schoolName" | "titleTemplate">;
}) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [teacherCount, setTeacherCount] = useState(initialTeacherCount);

  // Prefer the browser's local month/year so the default matches the user's
  // calendar even when the server runs in UTC. Only corrects when they differ.
  useEffect(() => {
    const now = new Date();
    const localMonth = now.getMonth() + 1;
    const localYear = now.getFullYear();
    setMonth((current) => (current === localMonth ? current : localMonth));
    setYear((current) => (current === localYear ? current : localYear));
  }, []);

  const days = daysInMonth(year, month);
  const pageCount = Math.max(1, Math.ceil(teacherCount / 3));
  const monthName = MONTHS[month - 1];

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      month: String(month),
      year: String(year),
      v: String(previewVersion)
    });
    return `/api/generate/pdf?${params.toString()}#toolbar=0&navpanes=0`;
  }, [month, year, previewVersion]);

  useEffect(() => {
    setLoading(true);
  }, [previewUrl]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 25000);
    return () => clearTimeout(timer);
  }, [loading]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setPreviewVersion((value) => value + 1);
    try {
      const response = await fetch("/api/teachers", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { teachers?: unknown[] };
        setTeacherCount(data.teachers?.length ?? 0);
      }
    } catch {
      // The preview itself still refreshes; the count is best-effort.
    }
  }, []);

  async function download(kind: "pdf" | "docx") {
    if (action) return;
    setAction(kind);
    try {
      const response = await fetch(
        `/api/generate/${kind}?month=${month}&year=${year}&download=1`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Download failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Teachers-Attendance-${monthName}-${year}.${kind}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${kind === "pdf" ? "PDF" : "DOCX"} downloaded.`, "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Download failed.", "error");
    } finally {
      setAction(null);
    }
  }

  async function print() {
    if (action) return;
    setAction("print");
    try {
      const frame = iframeRef.current;
      if (frame?.contentWindow) {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          return;
        } catch {
          // Fall through to the blob iframe fallback.
        }
      }

      const response = await fetch(`/api/generate/pdf?month=${month}&year=${year}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Could not prepare the PDF for printing.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.src = url;
      document.body.appendChild(printFrame);

      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        setTimeout(() => {
          URL.revokeObjectURL(url);
          printFrame.remove();
        }, 60000);
      };
    } catch (error) {
      toast(error instanceof Error ? error.message : "Printing failed.", "error");
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Sheet setup"
            description="Choose the month and year you want to print."
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Month" htmlFor="sheet-month">
                <Select
                  id="sheet-month"
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Year" htmlFor="sheet-year">
                <Select
                  id="sheet-year"
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {YEARS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">
                <CalendarDays className="mr-1 h-3 w-3" />
                {monthName} {year}
              </Badge>
              <Badge>
                <Users className="mr-1 h-3 w-3" />
                {teacherCount} teacher{teacherCount === 1 ? "" : "s"}
              </Badge>
              <Badge tone="green">
                {pageCount} page{pageCount === 1 ? "" : "s"} · {days} days
              </Badge>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Button
                onClick={() => download("pdf")}
                loading={action === "pdf"}
                disabled={action !== null}
                icon={<Download className="h-4 w-4" />}
                className="w-full"
              >
                Download PDF
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={print}
                  loading={action === "print"}
                  disabled={action !== null}
                  icon={<Printer className="h-4 w-4" />}
                >
                  Print
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => download("docx")}
                  loading={action === "docx"}
                  disabled={action !== null}
                  icon={<FileDown className="h-4 w-4" />}
                >
                  DOCX
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-xs leading-5 text-amber-900">
                In the print dialog, set Paper: A4, Scale: 100% (Actual size), Margins:
                None/Default, and turn off Headers and footers.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-school-50 text-school-600">
                <RefreshCw className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">Refresh preview</p>
                <p className="truncate text-xs text-slate-500">{settings.schoolName}</p>
              </div>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                Refresh
              </Button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              The preview regenerates with the latest teacher list, logo and settings every
              time you refresh.
            </p>
            {teacherCount === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-school-600" />
                <p className="text-xs leading-5 text-school-900">
                  No teachers yet. The sheet will show numbered empty slots.{" "}
                  <Link href="/teachers" className="font-semibold underline underline-offset-2">
                    Add teachers
                  </Link>
                  .
                </p>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader
          title="Live preview"
          description="Exactly what will be printed or downloaded."
          actions={
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              {loading ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  Generating…
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Up to date
                </>
              )}
            </span>
          }
        />
        <CardBody className="bg-slate-200/70 p-3 sm:p-5">
          <div className="pretty-scroll mx-auto max-w-[760px] overflow-auto rounded-lg bg-slate-300/60 p-3 sm:p-5">
            <div
              className="relative mx-auto w-full bg-white shadow-2xl"
              style={{ aspectRatio: "210 / 297" }}
            >
              <iframe
                ref={iframeRef}
                key={`${month}-${year}-${previewVersion}`}
                src={previewUrl}
                title="Attendance sheet preview"
                onLoad={() => setLoading(false)}
                className="absolute inset-0 h-full w-full border-0"
              />
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm">
                  <Spinner className="h-7 w-7" />
                  <p className="text-sm text-slate-500">Generating preview…</p>
                </div>
              ) : null}
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            The preview is the actual PDF. Use the Print button for a pixel-perfect A4 print.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
