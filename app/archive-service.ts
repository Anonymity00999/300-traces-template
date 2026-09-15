import { apiAbsolutePath, apiPath } from "./api-base";
import type { TraceType } from "./data/trace-types";

export type CommunityTrace = {
  id: string;
  schemaVersion?: number;
  recordKind?: "witness";
  url: string;
  publishedAt?: string;
  title: string;
  excerpt: string;
  reason?: string;
  createdAt: string;
  type?: TraceType;
  status: "approved";
};

export type CommunityGuestbook = {
  id: string;
  schemaVersion?: number;
  recordKind: "guestbook";
  message: string;
  name?: string;
  url?: string;
  title?: string;
  excerpt?: string;
  publishedAt?: string;
  sourceLabel?: string;
  createdAt: string;
  status: "approved";
};

export type CommunityMedia = {
  id: string;
  schemaVersion?: number;
  recordKind: "media";
  kind: "image" | "audio";
  url: string;
  publishedAt?: string;
  title?: string;
  caption?: string;
  name?: string;
  createdAt: string;
  status: "approved";
};

export type CommunityEvent = {
  id: string;
  schemaVersion?: number;
  recordKind: "event";
  date: string;
  url: string;
  sourceLabel?: string;
  title: string;
  excerpt: string;
  createdAt: string;
  status: "approved";
};

export type CommunityPayload = {
  traces?: CommunityTrace[];
  guestbook?: CommunityGuestbook[];
  media?: CommunityMedia[];
  events?: CommunityEvent[];
};

export const IS_MAINLAND_BUILD = Boolean(import.meta.env.VITE_MAINLAND_ONLY);
const configuredApiBase = (import.meta.env.VITE_ARCHIVE_API_BASE || "").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * A network request should be allowed to fail into the reader's local fallback.
 * In particular, a captive portal or a stalled regional route must not leave a
 * submission or progress sync pending forever.
 */
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

/** One explicit API boundary. Provider choice belongs in deployment config. */
function archiveEndpoint(path: string) {
  return apiPath(path);
}

export async function archiveRequestWithEndpoint(path: string, init: RequestInit = {}) {
  const endpoint = archiveEndpoint(path);
  const response = await fetchWithTimeout(endpoint, init);
  return { response, endpoint };
}

export async function archiveRequest(path: string, init: RequestInit = {}) {
  return (await archiveRequestWithEndpoint(path, init)).response;
}

export function resolveMediaPath(value: string, endpoint: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (endpoint.startsWith("cloudbase://")) return apiPath(value);
  if (configuredApiBase) return apiAbsolutePath(value, `${configuredApiBase}/`);
  return apiAbsolutePath(value);
}

export async function readCommunity(etag?: string): Promise<{ payload?: CommunityPayload; etag?: string; endpoint?: string; notModified?: boolean }> {
  const headers = etag ? { "if-none-match": etag } : undefined;
  const endpoint = archiveEndpoint("/api/community");
  const result = await fetchWithTimeout(endpoint, { ...(headers ? { headers } : {}), cache: "default" });
  if (result.status === 304) return { etag, endpoint, notModified: true };
  if (result.ok) return { payload: await result.json() as CommunityPayload, etag: result.headers.get("etag") || undefined, endpoint };
  return { endpoint };
}
