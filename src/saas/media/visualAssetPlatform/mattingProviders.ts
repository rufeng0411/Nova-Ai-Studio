// PD-SAAS-FORK VAP P1: pluggable matting providers (default = bbox fallback).

import sharp from "sharp";

export type MattingProviderId = "auto" | "bbox" | "rembg" | "cloud_segment";

export type MattingResult = {
  provider: MattingProviderId;
  buffer: Buffer;
  degraded: boolean;
  notes?: string;
};

/** Approximate subject bbox crop for near-solid backgrounds. */
export async function mattingBboxFallback(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;
      const a = channels > 3 ? (data[idx + 3] ?? 255) : 255;
      const isBg =
        a < 16
        || (r > 245 && g > 245 && b > 245)
        || (r < 12 && g < 12 && b < 12);
      if (isBg) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) {
    return sharp(buffer).png().toBuffer();
  }
  const pad = 8;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.min(width - left, maxX - minX + pad * 2);
  const cropH = Math.min(height - top, maxY - minY + pad * 2);
  return sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .ensureAlpha()
    .png()
    .toBuffer();
}

/**
 * Optional rembg HTTP endpoint (PILOTDECK_REMBG_URL). Fail-open to bbox.
 */
async function mattingViaRembg(buffer: Buffer): Promise<Buffer | null> {
  const endpoint = String(process.env.PILOTDECK_REMBG_URL ?? "").trim();
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buffer),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function runMattingProvider(
  buffer: Buffer,
  provider: MattingProviderId = "auto",
): Promise<MattingResult> {
  if (provider === "bbox") {
    return {
      provider: "bbox",
      buffer: await mattingBboxFallback(buffer),
      degraded: true,
      notes: "bbox_fallback",
    };
  }
  if (provider === "rembg" || provider === "auto" || provider === "cloud_segment") {
    const rembg = await mattingViaRembg(buffer);
    if (rembg) {
      return { provider: "rembg", buffer: rembg, degraded: false };
    }
  }
  return {
    provider: "bbox",
    buffer: await mattingBboxFallback(buffer),
    degraded: true,
    notes: "rembg_unavailable_bbox_fallback",
  };
}
