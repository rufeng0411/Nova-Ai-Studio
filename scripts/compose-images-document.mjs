#!/usr/bin/env node
/**
 * Compose ordered PNG/JPG images into a single PDF (one image per page).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

async function readImageBytes(filePath) {
  return fs.readFile(filePath);
}

/** Sniff real format — generated slides are often JPEG bytes saved as .png */
function mimeForImage(filePath, bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unsupported or unrecognized image format: ${filePath}`);
}

async function embedImageInPdf(pdf, filePath, bytes) {
  const mime = mimeForImage(filePath, bytes);
  if (mime === "image/png") return pdf.embedPng(bytes);
  if (mime === "image/jpeg") return pdf.embedJpg(bytes);
  throw new Error(`Unsupported image type for PDF (${mime}): ${filePath}`);
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = "";
  const images = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--output") {
      outputPath = args[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (args[i] === "--images") {
      i += 1;
      while (i < args.length && !args[i].startsWith("--")) {
        images.push(args[i]);
        i += 1;
      }
      i -= 1;
      continue;
    }
  }
  if (!outputPath || images.length === 0) {
    throw new Error("Usage: compose-images-document.mjs --output out.pdf --images a.png b.png");
  }

  const pdf = await PDFDocument.create();
  for (const imagePath of images) {
    const bytes = await readImageBytes(imagePath);
    const embedded = await embedImageInPdf(pdf, imagePath, bytes);
    const page = pdf.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
    });
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const outBytes = await pdf.save();
  await fs.writeFile(outputPath, outBytes);
  process.stdout.write(`Wrote PDF with ${images.length} page(s) to ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
