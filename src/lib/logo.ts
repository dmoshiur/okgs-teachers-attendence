import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { assets } from "./schema";
import { ensureReady } from "./db";

export const DEFAULT_LOGO_PATH = path.join(process.cwd(), "public", "logo.png");
export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const LOGO_MAX_SIDE = 600;

export type StoredLogo = {
  data: Buffer;
  mime: string;
  version: string;
};

export type PngLogo = {
  data: Buffer;
  width: number;
  height: number;
};

function hashBytes(data: Buffer | Uint8Array): string {
  return crypto.createHash("sha1").update(data).digest("hex").slice(0, 16);
}

export async function getLogo(): Promise<StoredLogo> {
  const db = await ensureReady();
  const row = await db.select().from(assets).where(eq(assets.key, "logo")).get();
  if (row) {
    const data = Buffer.from(row.data);
    return { data, mime: row.mime || "image/webp", version: hashBytes(data) };
  }

  const data = await fs.readFile(DEFAULT_LOGO_PATH);
  return { data, mime: "image/png", version: hashBytes(data) };
}

export async function getLogoVersion(): Promise<string> {
  const logo = await getLogo();
  return logo.version;
}

/**
 * The PDF and DOCX libraries do not reliably support WebP, so every logo is
 * decoded to PNG in memory before it is embedded.
 */
export async function getLogoAsPng(): Promise<PngLogo> {
  const logo = await getLogo();
  const { data, info } = await sharp(logo.data)
    .resize({
      width: LOGO_MAX_SIDE,
      height: LOGO_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true
    })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

const ALLOWED_FORMATS = new Set(["png", "jpeg", "jpg", "webp", "svg"]);

export async function saveLogo(input: Buffer): Promise<{ version: string; mime: string }> {
  const db = await ensureReady();

  const pipeline = sharp(input, { failOn: "error", density: 300 });
  const meta = await pipeline.metadata();
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new Error("Unsupported image format. Upload a PNG, JPG, WebP or SVG file.");
  }

  const { data, info } = await pipeline
    .rotate()
    .resize({
      width: LOGO_MAX_SIDE,
      height: LOGO_MAX_SIDE,
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  if (info.format !== "webp") {
    throw new Error("Logo conversion failed.");
  }

  await db
    .insert(assets)
    .values({ key: "logo", mime: "image/webp", data })
    .onConflictDoUpdate({
      target: assets.key,
      set: { mime: "image/webp", data }
    });

  return { version: hashBytes(data), mime: "image/webp" };
}

export async function resetLogo(): Promise<{ version: string; mime: string }> {
  const db = await ensureReady();
  await db.delete(assets).where(eq(assets.key, "logo"));
  const logo = await getLogo();
  return { version: logo.version, mime: logo.mime };
}
