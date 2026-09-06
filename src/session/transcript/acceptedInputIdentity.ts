// PD-SAAS-FORK: stable accepted-input identity without persisting raw attachment payloads.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { CanonicalContentBlock, CanonicalMessage } from "../../model/index.js";

export type AcceptedInputAttachmentDescriptor = {
  type: "file" | "image" | "text" | "unknown";
  name?: string;
  path?: string;
  mimeType?: string;
  bytes?: number;
  contentHash?: string;
};

export type AcceptedInputIdentity = {
  inputFingerprint: string;
  attachmentDescriptors: AcceptedInputAttachmentDescriptor[];
};

type AttachmentLike = {
  type?: unknown;
  name?: unknown;
  path?: unknown;
  mimeType?: unknown;
  mime?: unknown;
  bytes?: unknown;
  size?: unknown;
  content?: unknown;
  data?: unknown;
  hash?: unknown;
  sha256?: unknown;
  metadata?: unknown;
};

export function buildAcceptedInputIdentity(
  prompt: string,
  attachments: readonly unknown[] | undefined,
): AcceptedInputIdentity {
  const attachmentDescriptors = normalizeAcceptedInputAttachmentDescriptors(attachments);
  return {
    inputFingerprint: fingerprintAcceptedInput(prompt, attachmentDescriptors),
    attachmentDescriptors,
  };
}

export function buildAcceptedInputIdentityFromUi(
  prompt: string,
  images: readonly unknown[] | undefined,
  files: readonly unknown[] | undefined,
): AcceptedInputIdentity {
  const typedImages = (images ?? []).map((value) => withAttachmentType(value, "image"));
  const typedFiles = (files ?? []).map((value) => withAttachmentType(value, "file"));
  return buildAcceptedInputIdentity(prompt, [...typedImages, ...typedFiles]);
}

export async function buildAcceptedInputIdentityFromUiResolved(
  prompt: string,
  images: readonly unknown[] | undefined,
  files: readonly unknown[] | undefined,
  options: {
    allowedRoot: string;
    maxFileBytes?: number;
  },
): Promise<AcceptedInputIdentity> {
  const maxFileBytes = options.maxFileBytes ?? 20 * 1024 * 1024;
  const hashedFiles = await Promise.all(
    (files ?? []).map((file) => addBoundedFileContentHash(file, options.allowedRoot, maxFileBytes)),
  );
  return buildAcceptedInputIdentityFromUi(prompt, images, hashedFiles);
}

export function fingerprintAcceptedInput(
  prompt: string,
  attachmentDescriptors: readonly AcceptedInputAttachmentDescriptor[],
): string {
  const canonical = JSON.stringify({
    version: 1,
    prompt: String(prompt ?? "").replace(/\r\n?/g, "\n"),
    attachments: attachmentDescriptors,
  });
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function fingerprintAcceptedInputMessages(
  messages: readonly CanonicalMessage[],
  attachmentDescriptors?: readonly AcceptedInputAttachmentDescriptor[],
): string | null {
  const userMessages = messages.filter((message) => message.role === "user");
  if (userMessages.length === 0) return null;
  const prompt = userMessages
    .flatMap((message) => message.content)
    .filter((block): block is Extract<CanonicalContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  const descriptors = attachmentDescriptors
    ? [...attachmentDescriptors]
    : userMessages.flatMap((message) => descriptorsFromContent(message.content));
  return fingerprintAcceptedInput(prompt, descriptors);
}

export function normalizeAcceptedInputAttachmentDescriptors(
  attachments: readonly unknown[] | undefined,
): AcceptedInputAttachmentDescriptor[] {
  if (!attachments) return [];
  const descriptors: AcceptedInputAttachmentDescriptor[] = [];
  for (const value of attachments) {
    const descriptor = normalizeAttachment(value);
    if (descriptor) descriptors.push(descriptor);
  }
  return descriptors;
}

export function sanitizeAcceptedInputMessagesForDurability(
  messages: readonly CanonicalMessage[],
): CanonicalMessage[] {
  return messages.map((message) => ({
    ...message,
    content: message.content.filter(
      (block): block is Extract<CanonicalContentBlock, { type: "text" }> => block.type === "text",
    ).map((block) => ({ ...block })),
  }));
}

function normalizeAttachment(value: unknown): AcceptedInputAttachmentDescriptor | null {
  if (!isRecord(value)) return null;
  const attachment = value as AttachmentLike;
  const rawData = cleanString(attachment.content) ?? cleanString(attachment.data);
  const dataUrlMimeType = rawData?.match(/^data:([^;,]+)[;,]/i)?.[1];
  const declaredMimeType = cleanString(attachment.mimeType)
    ?? cleanString(attachment.mime)
    ?? cleanString(dataUrlMimeType);
  const explicitType = cleanString(attachment.type);
  const type = normalizeAttachmentType(explicitType, declaredMimeType, rawData);
  const mimeType = declaredMimeType ?? (type === "image" ? "image/png" : undefined);
  const name = cleanString(attachment.name);
  const path = normalizePath(cleanString(attachment.path));
  const bytes = normalizeBytes(attachment.bytes ?? attachment.size);
  const metadata = isRecord(attachment.metadata) ? attachment.metadata : undefined;
  const knownHash = cleanHash(
    attachment.sha256
    ?? attachment.hash
    ?? metadata?.sha256
    ?? metadata?.hash,
  );
  const contentHash = rawData
    ? hashAttachmentPayload(rawData, type, mimeType)
    : knownHash;
  return removeUndefined({
    type,
    name,
    path,
    mimeType: mimeType?.toLowerCase(),
    bytes,
    contentHash,
  });
}

function descriptorsFromContent(
  content: readonly CanonicalContentBlock[],
): AcceptedInputAttachmentDescriptor[] {
  const descriptors: AcceptedInputAttachmentDescriptor[] = [];
  for (const block of content) {
    switch (block.type) {
      case "image":
        descriptors.push(removeUndefined({
          type: "image",
          mimeType: block.mimeType.toLowerCase(),
          bytes: block.bytes,
          contentHash: hashCanonicalPayload(block.data, block.source === "base64"),
        }));
        break;
      case "pdf":
        descriptors.push({
          type: "file",
          mimeType: block.mimeType,
          bytes: block.bytes,
          contentHash: hashCanonicalPayload(block.data, true),
        });
        break;
      case "audio":
        descriptors.push(removeUndefined({
          type: "file",
          mimeType: block.mimeType.toLowerCase(),
          contentHash: hashCanonicalPayload(block.data, block.source === "base64"),
        }));
        break;
      case "text":
      case "thinking":
      case "tool_call":
      case "tool_result":
      case "tool_result_reference":
        break;
      default: {
        const exhaustive: never = block;
        return exhaustive;
      }
    }
  }
  return descriptors;
}

function normalizeAttachmentType(
  type: string | undefined,
  mimeType: string | undefined,
  rawData: string | undefined,
): AcceptedInputAttachmentDescriptor["type"] {
  if (type === "file" || type === "image" || type === "text" || type === "unknown") {
    return type;
  }
  if (mimeType?.toLowerCase().startsWith("image/") || rawData?.startsWith("data:image/")) {
    return "image";
  }
  return "unknown";
}

function hashAttachmentPayload(
  rawData: string | undefined,
  type: AcceptedInputAttachmentDescriptor["type"],
  mimeType: string | undefined,
): string | undefined {
  if (!rawData) return undefined;
  const dataUrl = rawData.match(/^data:([^;,]+);base64,([\s\S]*)$/i);
  const isBase64 = Boolean(dataUrl) || type === "image" || mimeType?.toLowerCase() === "application/pdf";
  return hashCanonicalPayload(dataUrl?.[2] ?? rawData, isBase64);
}

function hashCanonicalPayload(value: string, base64: boolean): string {
  const hash = createHash("sha256");
  if (base64) {
    hash.update(Buffer.from(value, "base64"));
  } else {
    hash.update(value, "utf8");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function addBoundedFileContentHash(
  value: unknown,
  allowedRoot: string,
  maxFileBytes: number,
): Promise<unknown> {
  if (!isRecord(value) || typeof value.path !== "string" || maxFileBytes <= 0) return value;
  try {
    const rootPath = await realpath(resolve(allowedRoot));
    const candidatePath = await realpath(
      isAbsolute(value.path) ? value.path : resolve(rootPath, value.path),
    );
    const relativePath = relative(rootPath, candidatePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) return value;
    const fileStat = await stat(candidatePath);
    if (!fileStat.isFile() || fileStat.size > maxFileBytes) return value;
    const hash = createHash("sha256");
    let bytesRead = 0;
    for await (const chunk of createReadStream(candidatePath)) {
      bytesRead += chunk.length;
      if (bytesRead > maxFileBytes) return value;
      hash.update(chunk);
    }
    return {
      ...value,
      size: fileStat.size,
      sha256: `sha256:${hash.digest("hex")}`,
    };
  } catch {
    return value;
  }
}

function withAttachmentType(value: unknown, type: AcceptedInputAttachmentDescriptor["type"]): unknown {
  return isRecord(value) ? { ...value, type } : value;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned || undefined;
}

function normalizePath(value: string | undefined): string | undefined {
  return value?.replace(/\\/g, "/");
}

function normalizeBytes(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function cleanHash(value: unknown): string | undefined {
  const hash = cleanString(value)?.toLowerCase();
  if (!hash) return undefined;
  if (/^sha256:[a-f0-9]{64}$/.test(hash)) return hash;
  if (/^[a-f0-9]{64}$/.test(hash)) return `sha256:${hash}`;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as T;
}
