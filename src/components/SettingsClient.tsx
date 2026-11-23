"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { RotateCcw, Save, Upload } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, Input, Spinner, Switch } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type Settings = {
  schoolName: string;
  titleTemplate: string;
  fillEmptySlots: boolean;
  zebra: boolean;
  showDesignation: boolean;
};

const ACCEPTED = ".png,.jpg,.jpeg,.webp,.svg";
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

function fileIsLogo(file: File): boolean {
  const okTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const name = file.name.toLowerCase();
  return (
    okTypes.includes(file.type) ||
    [".png", ".jpg", ".jpeg", ".webp", ".svg"].some((ext) => name.endsWith(ext))
  );
}

export function SettingsClient({
  initialSettings,
  initialLogoVersion
}: {
  initialSettings: Settings;
  initialLogoVersion: string;
}) {
  const { toast } = useToast();

  const [schoolName, setSchoolName] = useState(initialSettings.schoolName);
  const [titleTemplate, setTitleTemplate] = useState(initialSettings.titleTemplate);
  const [savedSheet, setSavedSheet] = useState({
    schoolName: initialSettings.schoolName,
    titleTemplate: initialSettings.titleTemplate
  });
  const [fillEmptySlots, setFillEmptySlots] = useState(initialSettings.fillEmptySlots);
  const [zebra, setZebra] = useState(initialSettings.zebra);
  const [showDesignation, setShowDesignation] = useState(initialSettings.showDesignation);

  const [logoVersion, setLogoVersion] = useState(initialLogoVersion);
  const [savingSheet, setSavingSheet] = useState(false);
  const [savingToggle, setSavingToggle] = useState<
    "fillEmptySlots" | "zebra" | "showDesignation" | null
  >(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const logoSrc = `/api/logo?v=${encodeURIComponent(logoVersion)}`;

  const dirtySheet =
    schoolName !== savedSheet.schoolName || titleTemplate !== savedSheet.titleTemplate;

  async function saveSheet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingSheet) return;

    if (!schoolName.trim()) {
      toast("School name cannot be empty.", "error");
      return;
    }

    setSavingSheet(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName,
          titleTemplate,
          fillEmptySlots,
          zebra,
          showDesignation
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save settings.");
      setSavedSheet({ schoolName, titleTemplate });
      toast("Sheet settings saved.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save settings.", "error");
    } finally {
      setSavingSheet(false);
    }
  }

  async function updateToggle(
    key: "fillEmptySlots" | "zebra" | "showDesignation",
    value: boolean
  ) {
    if (key === "fillEmptySlots") setFillEmptySlots(value);
    else if (key === "zebra") setZebra(value);
    else setShowDesignation(value);

    setSavingToggle(key);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Persist the already-saved heading values so an unsaved edit in the
        // text fields is not silently committed by a toggle click.
        body: JSON.stringify({
          schoolName: savedSheet.schoolName,
          titleTemplate: savedSheet.titleTemplate,
          fillEmptySlots: key === "fillEmptySlots" ? value : fillEmptySlots,
          zebra: key === "zebra" ? value : zebra,
          showDesignation: key === "showDesignation" ? value : showDesignation
        })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "Could not save settings.");

      const message =
        key === "fillEmptySlots"
          ? "Empty slot filling turned " + (value ? "on." : "off.")
          : key === "zebra"
            ? "Zebra shading turned " + (value ? "on." : "off.")
            : "Designation under name turned " + (value ? "on." : "off.");
      toast(message);
    } catch (error) {
      if (key === "fillEmptySlots") setFillEmptySlots(!value);
      else if (key === "zebra") setZebra(!value);
      else setShowDesignation(!value);
      toast(error instanceof Error ? error.message : "Could not save settings.", "error");
    } finally {
      setSavingToggle(null);
    }
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!fileIsLogo(file)) {
      toast("Choose a PNG, JPG, WebP or SVG image.", "error");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast("That image is larger than 5 MB.", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/logo/upload", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as {
        version?: string;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Could not upload the logo.");
      if (data?.version) setLogoVersion(data.version);
      toast("Logo updated.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not upload the logo.", "error");
    } finally {
      setUploading(false);
    }
  }

  async function resetLogo() {
    if (resetting) return;
    setResetting(true);
    try {
      const response = await fetch("/api/logo/reset", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        version?: string;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error || "Could not reset the logo.");
      if (data?.version) setLogoVersion(data.version);
      toast("Default logo restored.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not reset the logo.", "error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Sheet heading"
            description="Shown at the top of every printed page."
          />
          <CardBody>
            <form onSubmit={saveSheet} className="space-y-4">
              <Field
                label="School name"
                htmlFor="school-name"
                hint="English or Bangla"
              >
                <Input
                  id="school-name"
                  value={schoolName}
                  maxLength={120}
                  onChange={(event) => setSchoolName(event.target.value)}
                  dir="auto"
                />
              </Field>

              <Field
                label="Sheet title template"
                htmlFor="title-template"
                hint={
                  <span>
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      {"{Month}"}
                    </code>{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
                      {"{Year}"}
                    </code>
                  </span>
                }
              >
                <Input
                  id="title-template"
                  value={titleTemplate}
                  maxLength={120}
                  onChange={(event) => setTitleTemplate(event.target.value)}
                  dir="auto"
                />
              </Field>

              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                Preview:{" "}
                <span className="font-semibold text-slate-800">
                  {titleTemplate.replaceAll("{Month}", "January").replaceAll("{Year}", "2026")}
                </span>
              </p>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  loading={savingSheet}
                  disabled={!dirtySheet}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Print options"
            description="Applied to the sheet immediately."
          />
          <CardBody className="space-y-3">
            <Switch
              checked={fillEmptySlots}
              onChange={(value) => void updateToggle("fillEmptySlots", value)}
              disabled={savingToggle !== null}
              label="Fill empty numbered slots on the last page"
              description="When the last page is not full, show the remaining numbers with blank name boxes."
            />
            <Switch
              checked={zebra}
              onChange={(value) => void updateToggle("zebra", value)}
              disabled={savingToggle !== null}
              label="Zebra row shading"
              description="Light grey shading on every second day row to keep the eye on the line."
            />
            <Switch
              checked={showDesignation}
              onChange={(value) => void updateToggle("showDesignation", value)}
              disabled={savingToggle !== null}
              label="Show designation under name"
              description="Print each person's designation (e.g. Head Teacher) under their name in a smaller font."
            />
            {savingToggle ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Spinner className="h-3.5 w-3.5" />
                Saving…
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-6 self-start">
        <Card>
          <CardHeader title="School logo" description="Printed in the header of every page." />
          <CardBody className="space-y-4">
            <div className="checkerboard flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={logoVersion}
                src={logoSrc}
                alt="Current school logo"
                className="h-full w-full object-contain p-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={() => fileInput.current?.click()}
                loading={uploading}
                disabled={resetting}
                icon={<Upload className="h-4 w-4" />}
              >
                Upload
              </Button>
              <Button
                variant="secondary"
                onClick={() => void resetLogo()}
                loading={resetting}
                disabled={uploading}
                icon={<RotateCcw className="h-4 w-4" />}
              >
                Default
              </Button>
            </div>

            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              onChange={(event) => void uploadLogo(event)}
              className="sr-only"
              aria-label="Choose a logo file"
            />

            <ul className="space-y-1 text-xs leading-5 text-slate-500">
              <li>PNG, JPG, WebP or SVG, up to 5 MB.</li>
              <li>Images are resized to 600 px and converted to WebP.</li>
              <li>Transparency is preserved.</li>
            </ul>
          </CardBody>
        </Card>

        <Card className={cn("border-school-200 bg-school-50/60")}>
          <CardBody>
            <p className="text-xs leading-5 text-school-900">
              Changes appear on the sheet the next time you generate or refresh it.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
