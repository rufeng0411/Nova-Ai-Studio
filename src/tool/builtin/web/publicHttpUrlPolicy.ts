// PD-SAAS-FORK P0-3: authoritative public HTTP/DNS/redirect/body safety policy.

import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

import { getDomain } from "tldts";
import { Agent, fetch as undiciFetch } from "undici";

export const MAX_PUBLIC_REDIRECTS = 5;
export const DEFAULT_PUBLIC_HTML_MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_PUBLIC_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const DEFAULT_PUBLIC_OTHER_MAX_BYTES = 5 * 1024 * 1024;

export type PublicDnsAddress = {
  address: string;
  family: 4 | 6;
};

export type PublicDnsResolver = (
  hostname: string,
) => Promise<PublicDnsAddress[]>;

export type PublicHttpLookup = LookupFunction;

export type ResolvedPublicHttpTarget = {
  url: URL;
  hostname: string;
  registrableDomain: string | null;
  addresses: PublicDnsAddress[];
  lookup: PublicHttpLookup;
};

export type PublicHttpExpectedKind = "html" | "image" | "any";

export type FetchPublicHttpResourceOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
  resolver?: PublicDnsResolver;
  fetchImpl?: typeof fetch;
  expectedKind?: PublicHttpExpectedKind;
  maxRedirects?: number;
  maxHtmlBytes?: number;
  maxImageBytes?: number;
  maxOtherBytes?: number;
};

export type PublicHttpRedirectHop = {
  status: number;
  fromUrl: string;
  toUrl: string;
};

export type PublicHttpResource = {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  buffer: Buffer;
  redirects: PublicHttpRedirectHop[];
};

export type PublicHttpPolicyErrorCode =
  | "invalid_url"
  | "invalid_protocol"
  | "embedded_credentials"
  | "non_standard_port"
  | "non_public_hostname"
  | "non_public_address"
  | "dns_resolution_failed"
  | "dns_rebinding_blocked"
  | "cross_host_redirect"
  | "too_many_redirects"
  | "invalid_content_length"
  | "response_too_large";

export class PublicHttpPolicyError extends Error {
  readonly name = "PublicHttpPolicyError";

  constructor(
    readonly code: PublicHttpPolicyErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const CLOUD_METADATA_HOSTS = new Set([
  "metadata",
  "metadata.google.internal",
  "metadata.google",
  "metadata.azure.internal",
  "instance-data",
]);

const CLOUD_METADATA_IPV4 = new Set([
  "168.63.129.16",
  "169.254.169.254",
  "169.254.170.2",
  "100.100.100.200",
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const defaultPublicDnsResolver: PublicDnsResolver = async (hostname) => {
  const answers = await dnsLookup(hostname, {
    all: true,
    verbatim: true,
  });
  return answers
    .filter(
      (answer): answer is { address: string; family: 4 | 6 } =>
        answer.family === 4 || answer.family === 6,
    )
    .map((answer) => ({
      address: answer.address,
      family: answer.family,
    }));
};

/** PD-SAAS-FORK VAP: DoH fallback when system DNS returns non-public / fails. */
const DOH_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
] as const;

async function queryDohEndpoint(
  endpoint: string,
  hostname: string,
): Promise<PublicDnsAddress[]> {
  const url = new URL(endpoint);
  url.searchParams.set("name", hostname);
  url.searchParams.set("type", "A");
  const response = await fetch(url, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return [];
  const payload = await response.json() as {
    Answer?: Array<{ type?: number; data?: string }>;
  };
  const addresses: PublicDnsAddress[] = [];
  for (const answer of payload.Answer ?? []) {
    if (answer.type !== 1 || typeof answer.data !== "string") continue;
    const address = answer.data.trim();
    if (isIP(address) === 4 && isPublicIpAddress(address)) {
      addresses.push({ address, family: 4 });
    }
  }
  return addresses;
}

async function resolveViaDoh(hostname: string): Promise<PublicDnsAddress[]> {
  const races = DOH_ENDPOINTS.map(async (endpoint) => {
    const addresses = await queryDohEndpoint(endpoint, hostname);
    if (addresses.length === 0) {
      throw new Error("DoH returned no public addresses.");
    }
    return addresses;
  });
  try {
    return await Promise.any(races);
  } catch {
    return [];
  }
}

/**
 * PD-SAAS-FORK VAP: official-media DNS resolver — system DNS first, then DoH
 * when answers are empty or contain non-public addresses.
 */
export function createOfficialMediaDnsResolver(
  systemResolver: PublicDnsResolver = defaultPublicDnsResolver,
): PublicDnsResolver {
  return async (hostname) => {
    let systemAddresses: PublicDnsAddress[] = [];
    try {
      systemAddresses = await systemResolver(hostname);
    } catch {
      systemAddresses = [];
    }
    const publicSystem = systemAddresses.filter(
      (entry) =>
        (entry.family === 4 || entry.family === 6)
        && isPublicIpAddress(stripIpv6Brackets(entry.address)),
    );
    if (publicSystem.length > 0) return publicSystem;
    const dohAddresses = await resolveViaDoh(hostname);
    if (dohAddresses.length > 0) return dohAddresses;
    if (systemAddresses.length > 0) return systemAddresses;
    throw new PublicHttpPolicyError(
      "dns_resolution_failed",
      "Public URL DNS resolution failed.",
    );
  };
}

function stripIpv6Brackets(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

function normalizeHostname(hostname: string): string {
  return stripIpv6Brackets(hostname).toLowerCase().replace(/\.$/u, "");
}

function ipv4ToNumber(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) return null;
    const octet = Number.parseInt(part, 10);
    if (octet < 0 || octet > 255) return null;
    value = (value * 256) + octet;
  }
  return value >>> 0;
}

function ipv4InCidr(address: number, base: number, prefix: number): boolean {
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (base & mask);
}

function isPublicIpv4(address: string): boolean {
  if (CLOUD_METADATA_IPV4.has(address)) return false;
  const numeric = ipv4ToNumber(address);
  if (numeric === null) return false;
  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return !blocked.some(([base, prefix]) => {
    const baseNumber = ipv4ToNumber(base);
    return baseNumber !== null && ipv4InCidr(numeric, baseNumber, prefix);
  });
}

function parseIpv6(address: string): Uint8Array | null {
  const withoutZone = address.toLowerCase().split("%", 1)[0] ?? "";
  if (!withoutZone) return null;

  let normalized = withoutZone;
  const lastColon = normalized.lastIndexOf(":");
  const ipv4Tail = normalized.slice(lastColon + 1);
  if (ipv4Tail.includes(".")) {
    const numeric = ipv4ToNumber(ipv4Tail);
    if (numeric === null) return null;
    const high = ((numeric >>> 16) & 0xffff).toString(16);
    const low = (numeric & 0xffff).toString(16);
    normalized = `${normalized.slice(0, lastColon)}:${high}:${low}`;
  }

  const compressionParts = normalized.split("::");
  if (compressionParts.length > 2) return null;
  const left = compressionParts[0]
    ? compressionParts[0].split(":").filter(Boolean)
    : [];
  const right = compressionParts.length === 2 && compressionParts[1]
    ? compressionParts[1].split(":").filter(Boolean)
    : [];
  if (left.length + right.length > 8) return null;
  const fill = compressionParts.length === 2
    ? new Array(8 - left.length - right.length).fill("0")
    : [];
  const groups = [...left, ...fill, ...right];
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index] ?? "";
    if (!/^[0-9a-f]{1,4}$/u.test(group)) return null;
    const value = Number.parseInt(group, 16);
    bytes[index * 2] = value >>> 8;
    bytes[(index * 2) + 1] = value & 0xff;
  }
  return bytes;
}

function bytesMatchPrefix(
  address: Uint8Array,
  prefix: Uint8Array,
  bits: number,
): boolean {
  const fullBytes = Math.floor(bits / 8);
  for (let index = 0; index < fullBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  const remaining = bits % 8;
  if (remaining === 0) return true;
  const mask = (0xff << (8 - remaining)) & 0xff;
  return (
    ((address[fullBytes] ?? 0) & mask)
      === ((prefix[fullBytes] ?? 0) & mask)
  );
}

function ipv6Prefix(value: string): Uint8Array {
  const parsed = parseIpv6(value);
  if (!parsed) {
    throw new Error(`Invalid internal IPv6 prefix: ${value}`);
  }
  return parsed;
}

const BLOCKED_IPV6_PREFIXES: Array<[Uint8Array, number]> = [
  [ipv6Prefix("::"), 128],
  [ipv6Prefix("::1"), 128],
  [ipv6Prefix("::"), 8],
  [ipv6Prefix("64:ff9b:1::"), 48],
  [ipv6Prefix("100::"), 64],
  [ipv6Prefix("2001::"), 23],
  [ipv6Prefix("2001:db8::"), 32],
  [ipv6Prefix("2002::"), 16],
  [ipv6Prefix("3fff::"), 20],
  [ipv6Prefix("5f00::"), 16],
  [ipv6Prefix("fc00::"), 7],
  [ipv6Prefix("fe80::"), 10],
  [ipv6Prefix("fec0::"), 10],
  [ipv6Prefix("ff00::"), 8],
];

function isPublicIpv6(address: string): boolean {
  const parsed = parseIpv6(address);
  if (!parsed) return false;

  const isIpv4Mapped =
    parsed.slice(0, 10).every((value) => value === 0)
    && parsed[10] === 0xff
    && parsed[11] === 0xff;
  if (isIpv4Mapped) {
    return isPublicIpv4(
      `${parsed[12]}.${parsed[13]}.${parsed[14]}.${parsed[15]}`,
    );
  }

  return !BLOCKED_IPV6_PREFIXES.some(([prefix, bits]) =>
    bytesMatchPrefix(parsed, prefix, bits)
  );
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = stripIpv6Brackets(address);
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

export function getRegistrableDomain(value: string): string | null {
  let hostname = value;
  try {
    hostname = new URL(value).hostname;
  } catch {
    // The caller may already be providing a hostname.
  }
  const normalized = normalizeHostname(hostname);
  if (!normalized || isIP(normalized) !== 0) return null;
  return getDomain(normalized);
}

export function normalizePublicHttpUrl(input: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new PublicHttpPolicyError(
      "invalid_url",
      "Public URL is malformed.",
    );
  }

  if (parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }
  if (parsed.protocol !== "https:") {
    throw new PublicHttpPolicyError(
      "invalid_protocol",
      "Public URL must use HTTPS.",
    );
  }
  if (parsed.username || parsed.password) {
    throw new PublicHttpPolicyError(
      "embedded_credentials",
      "Public URL must not contain embedded credentials.",
    );
  }
  if (parsed.port && parsed.port !== "443") {
    throw new PublicHttpPolicyError(
      "non_standard_port",
      "Public URL uses a non-standard port.",
    );
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (
    !hostname
    || hostname === "localhost"
    || hostname.endsWith(".localhost")
    || CLOUD_METADATA_HOSTS.has(hostname)
  ) {
    throw new PublicHttpPolicyError(
      "non_public_hostname",
      "Public URL hostname is non-public.",
    );
  }

  const family = isIP(hostname);
  if (family !== 0) {
    if (!isPublicIpAddress(hostname)) {
      throw new PublicHttpPolicyError(
        "non_public_address",
        "Public URL contains a non-public IP address.",
      );
    }
    return parsed;
  }

  if (!getRegistrableDomain(hostname)) {
    throw new PublicHttpPolicyError(
      "non_public_hostname",
      "Public URL must use a registrable multi-label hostname.",
    );
  }
  return parsed;
}

function createLookupError(message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = "ENOTFOUND";
  return error;
}

function createPinnedLookup(
  expectedHostname: string,
  addresses: PublicDnsAddress[],
): PublicHttpLookup {
  return (hostname, options, callback) => {
    const requestedHostname = normalizeHostname(hostname);
    if (requestedHostname !== expectedHostname) {
      callback(
        createLookupError("DNS rebinding blocked: lookup hostname changed."),
        "",
        0,
      );
      return;
    }

    const requestedFamily =
      typeof options === "number"
        ? options
        : typeof options.family === "number"
          ? options.family
          : 0;
    const matching = requestedFamily === 4 || requestedFamily === 6
      ? addresses.filter((entry) => entry.family === requestedFamily)
      : addresses;
    if (matching.length === 0) {
      callback(
        createLookupError("DNS rebinding blocked: no pinned address for family."),
        "",
        0,
      );
      return;
    }

    if (typeof options !== "number" && options.all) {
      callback(null, matching);
      return;
    }
    const selected = matching[0]!;
    callback(null, selected.address, selected.family);
  };
}

export async function resolvePublicHttpTarget(
  input: string,
  resolver: PublicDnsResolver = defaultPublicDnsResolver,
): Promise<ResolvedPublicHttpTarget> {
  const url = normalizePublicHttpUrl(input);
  const hostname = normalizeHostname(url.hostname);
  const literalFamily = isIP(hostname);
  let addresses: PublicDnsAddress[];

  if (literalFamily === 4 || literalFamily === 6) {
    addresses = [{
      address: hostname,
      family: literalFamily,
    }];
  } else {
    try {
      addresses = await resolver(hostname);
    } catch {
      throw new PublicHttpPolicyError(
        "dns_resolution_failed",
        "Public URL DNS resolution failed.",
      );
    }
  }

  if (addresses.length === 0) {
    throw new PublicHttpPolicyError(
      "dns_resolution_failed",
      "Public URL DNS resolution returned no addresses.",
    );
  }
  const normalizedAddresses = addresses.map((entry) => ({
    address: stripIpv6Brackets(entry.address),
    family: entry.family,
  }));
  if (
    normalizedAddresses.some(
      (entry) =>
        (entry.family !== 4 && entry.family !== 6)
        || isIP(entry.address) !== entry.family
        || !isPublicIpAddress(entry.address),
    )
  ) {
    throw new PublicHttpPolicyError(
      "non_public_address",
      "Public URL DNS returned a non-public address.",
    );
  }

  return {
    url,
    hostname,
    registrableDomain: getRegistrableDomain(hostname),
    addresses: normalizedAddresses,
    lookup: createPinnedLookup(hostname, normalizedAddresses),
  };
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./u, "");
}

function isSameHostOrWww(left: URL, right: URL): boolean {
  return (
    stripWww(normalizeHostname(left.hostname))
      === stripWww(normalizeHostname(right.hostname))
  );
}

/** PD-SAAS-FORK ES9/VAP: official brand TLD pairs may redirect across registrable domains. */
const OFFICIAL_CROSS_HOST_REDIRECT_GROUPS: readonly (readonly string[])[] = [
  ["nio.com", "nio.cn"],
  ["bfgoodrich.com", "bfgoodrich.com.cn"],
  ["michelin.com", "michelin.com.cn"],
  ["qq.com", "gtimg.cn"],
];

function registrableDomainForRedirect(hostname: string): string | null {
  return getRegistrableDomain(normalizeHostname(hostname));
}

export function isAllowedOfficialCrossHostRedirect(from: URL, to: URL): boolean {
  const fromDomain = registrableDomainForRedirect(from.hostname);
  const toDomain = registrableDomainForRedirect(to.hostname);
  if (!fromDomain || !toDomain) return false;
  if (fromDomain === toDomain) return true;
  for (const group of OFFICIAL_CROSS_HOST_REDIRECT_GROUPS) {
    const normalized = group.map((entry) => entry.toLowerCase());
    if (normalized.includes(fromDomain) && normalized.includes(toDomain)) {
      return true;
    }
  }
  return false;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function resolveBoundedCeiling(
  value: number | undefined,
  upperBound: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return upperBound;
  }
  return Math.max(0, Math.min(Math.floor(value), upperBound));
}

function resolveResponseLimit(
  contentType: string,
  options: FetchPublicHttpResourceOptions,
): number {
  const expectedKind = options.expectedKind ?? "any";
  if (
    expectedKind === "html"
    || contentType.includes("text/html")
    || contentType.includes("application/xhtml+xml")
  ) {
    return resolveBoundedCeiling(
      options.maxHtmlBytes,
      DEFAULT_PUBLIC_HTML_MAX_BYTES,
    );
  }
  if (expectedKind === "image" || contentType.startsWith("image/")) {
    return resolveBoundedCeiling(
      options.maxImageBytes,
      DEFAULT_PUBLIC_IMAGE_MAX_BYTES,
    );
  }
  return resolveBoundedCeiling(
    options.maxOtherBytes,
    DEFAULT_PUBLIC_OTHER_MAX_BYTES,
  );
}

function validateContentLength(
  rawContentLength: string | null,
  maxBytes: number,
): void {
  if (rawContentLength === null) return;
  if (!/^\d+$/u.test(rawContentLength)) {
    throw new PublicHttpPolicyError(
      "invalid_content_length",
      "Response Content-Length is invalid.",
    );
  }
  const contentLength = Number.parseInt(rawContentLength, 10);
  if (!Number.isSafeInteger(contentLength) || contentLength > maxBytes) {
    throw new PublicHttpPolicyError(
      "response_too_large",
      "Response Content-Length exceeds the public response limit.",
    );
  }
}

async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  validateContentLength(response.headers.get("content-length"), maxBytes);
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = Buffer.from(next.value);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new PublicHttpPolicyError(
        "response_too_large",
        "Response streamed body exceeds the public response limit.",
      );
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, totalBytes);
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body) return;
  await response.body.cancel().catch(() => {});
}

function bridgeAbortSignalForUndici(
  signal?: AbortSignal | null,
): AbortSignal | undefined {
  if (!signal) return undefined;
  const controller = new AbortController();
  if (signal.aborted) {
    controller.abort(signal.reason);
    return controller.signal;
  }
  signal.addEventListener(
    "abort",
    () => controller.abort(signal.reason),
    { once: true },
  );
  return controller.signal;
}

async function fetchOnePublicTarget(
  target: ResolvedPublicHttpTarget,
  options: FetchPublicHttpResourceOptions,
): Promise<{ response: Response; dispatcher: Agent }> {
  const dispatcher = new Agent({
    connect: {
      lookup: target.lookup,
    },
  });
  // Node global fetch + undici Agent dispatcher is incompatible (UND_ERR_INVALID_ARG).
  const fetchImpl = options.fetchImpl ?? undiciFetch;
  try {
    const init = {
      method: "GET",
      redirect: "manual",
      headers: options.headers,
      signal: bridgeAbortSignalForUndici(options.signal),
      dispatcher,
    } as RequestInit & { dispatcher: Agent };
    const response = await (
      fetchImpl as (input: string, init?: RequestInit & { dispatcher?: Agent }) => Promise<Response>
    )(target.url.toString(), init);
    return { response, dispatcher };
  } catch (error) {
    await dispatcher.close().catch(() => {});
    throw error;
  }
}

export async function fetchPublicHttpResource(
  input: string,
  options: FetchPublicHttpResourceOptions = {},
): Promise<PublicHttpResource> {
  const resolver = options.resolver ?? defaultPublicDnsResolver;
  const maxRedirects = resolveBoundedCeiling(
    options.maxRedirects,
    MAX_PUBLIC_REDIRECTS,
  );
  const redirects: PublicHttpRedirectHop[] = [];
  let currentUrl = normalizePublicHttpUrl(input);

  while (true) {
    const target = await resolvePublicHttpTarget(
      currentUrl.toString(),
      resolver,
    );
    const { response, dispatcher } = await fetchOnePublicTarget(
      target,
      options,
    );
    try {
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new PublicHttpPolicyError(
            "invalid_url",
            "Redirect response is missing Location.",
          );
        }
        if (redirects.length >= maxRedirects) {
          throw new PublicHttpPolicyError(
            "too_many_redirects",
            `Public request exceeded ${maxRedirects} redirect hops.`,
          );
        }
        const redirectUrl = normalizePublicHttpUrl(
          new URL(location, target.url).toString(),
        );
        if (
          !isSameHostOrWww(target.url, redirectUrl)
          && !isAllowedOfficialCrossHostRedirect(target.url, redirectUrl)
        ) {
          throw new PublicHttpPolicyError(
            "cross_host_redirect",
            "Public request blocked a cross-host redirect.",
          );
        }
        redirects.push({
          status: response.status,
          fromUrl: target.url.toString(),
          toUrl: redirectUrl.toString(),
        });
        await cancelResponseBody(response);
        currentUrl = redirectUrl;
        continue;
      }

      const contentType = response.headers
        .get("content-type")
        ?.toLowerCase() ?? "";
      const maxBytes = resolveResponseLimit(contentType, options);
      const buffer = await readBoundedBody(response, maxBytes);
      return {
        url: target.url.toString(),
        status: response.status,
        statusText: response.statusText,
        headers: headersToRecord(response.headers),
        buffer,
        redirects,
      };
    } finally {
      await dispatcher.close().catch(() => {});
    }
  }
}
