import { get, list, put } from "@vercel/blob";

export const DATE_FROM = "2026-03-16";
export const DATE_TO = "2026-03-22";
export const ARCHIVE_SCHEMA_VERSION = 1;
export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_AUDIO_BYTES = 2_000_000;

const submissionRate = new Map<string, { startedAt: number; count: number }>();
const SUBMISSION_RATE_WINDOW = 10 * 60 * 1000;
const SUBMISSION_RATE_MAX = 5;

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status)
    .setHeader("content-type", "application/json; charset=utf-8")
    .setHeader("access-control-allow-origin", "*")
    .setHeader("access-control-allow-methods", "GET,POST,OPTIONS")
    .setHeader("access-control-allow-headers", "content-type,x-archive-ingest-key,x-archive-admin-key,x-archive-submission-id")
    .setHeader("access-control-max-age", "86400");
  res.send(JSON.stringify(body));
}

export function bodyOf(req: any): Record<string, unknown> {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body) as Record<string, unknown>; } catch { return {}; }
  }
  return req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
}

export function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validArchiveKey(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

export function validSubmissionId(value: unknown) {
  return typeof value === "string" && /^[a-f0-9-]{20,80}$/i.test(value);
}

export function submissionId(req: any, input: Record<string, unknown>) {
  const header = req.headers?.["x-archive-submission-id"];
  const candidate = typeof header === "string" ? header : input.submissionId;
  return validSubmissionId(candidate) ? candidate as string : crypto.randomUUID();
}

export function isAdmin(req: any) {
  const provided = req.headers?.["x-archive-admin-key"];
  return typeof provided === "string" && Boolean(process.env.ARCHIVE_ADMIN_KEY) && provided === process.env.ARCHIVE_ADMIN_KEY;
}

export async function readJson<T>(pathname: string, options: { useCache?: boolean } = {}): Promise<T | null> {
  const result = await get(pathname, { access: "private", useCache: options.useCache ?? false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  try { return JSON.parse(await new Response(result.stream).text()) as T; } catch { return null; }
}

export async function existingSubmission<T extends { id: string }>(id: string): Promise<T | null> {
  const [pending, approved] = await Promise.all([
    readJson<T>(`submissions/pending/${id}.json`),
    readJson<T>(`submissions/approved/${id}.json`),
  ]);
  return pending || approved;
}

export async function writeJson(pathname: string, value: unknown) {
  return put(pathname, JSON.stringify(value), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
    cacheControlMaxAge: 60,
  });
}

export async function listJson<T>(prefix: string): Promise<T[]> {
  const paths: string[] = [];
  let cursor: string | undefined;
  let pages = 0;
  do {
    const found = await list({ prefix, limit: 1000, cursor });
    paths.push(...found.blobs.map((blob) => blob.pathname));
    cursor = found.hasMore ? found.cursor : undefined;
    pages += 1;
  } while (cursor && pages < 20);
  const items = await Promise.all(paths.map((pathname) => readJson<T>(pathname)));
  return items.filter((item): item is NonNullable<typeof item> => item !== null) as T[];
}

type ApprovedWitness = {
  id: string;
  schemaVersion?: number;
  recordKind?: "witness";
  url: string;
  publishedAt?: string;
  title?: string;
  excerpt?: string;
  createdAt: string;
  type?: "idea" | "article" | "answer";
  status: "approved";
};

type ApprovedGuestbook = {
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

type ApprovedEvent = {
  id: string;
  schemaVersion?: number;
  recordKind: "event";
  date: string;
  url: string;
  sourceLabel?: string;
  title?: string;
  excerpt?: string;
  createdAt: string;
  status: "approved";
};

export type ApprovedMedia = {
  id: string;
  schemaVersion?: number;
  recordKind: "media";
  sourceRegion?: "global" | "mainland";
  kind: "image" | "audio";
  media: { pathname: string; contentType: string; bytes: number; durationSeconds?: number };
  publishedAt?: string;
  title?: string;
  caption?: string;
  name?: string;
  createdAt: string;
  status: "approved";
};

export type PublicCommunityIndex = {
  version: 1;
  updatedAt: string;
  traces: Array<{
    id: string;
    schemaVersion?: number;
    recordKind: "witness";
    url: string;
    publishedAt?: string;
    title: string;
    excerpt: string;
    createdAt: string;
    type?: "idea" | "article" | "answer";
    status: "approved";
  }>;
  guestbook: Array<{
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
  }>;
  events: Array<{
    id: string;
    schemaVersion?: number;
    recordKind: "event";
    date: string;
    url: string;
    sourceLabel: string;
    title: string;
    excerpt: string;
    createdAt: string;
    status: "approved";
  }>;
  media: Array<{
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
  }>;
};

export type ApprovedCommunityRecord = ApprovedWitness | ApprovedGuestbook | ApprovedEvent | ApprovedMedia;

function publicWitness(item: ApprovedWitness): PublicCommunityIndex["traces"][number] {
  return {
    id: item.id,
    schemaVersion: item.schemaVersion,
    recordKind: "witness",
    url: item.url,
    publishedAt: item.publishedAt,
    title: item.title || item.url,
    excerpt: item.excerpt || "",
    createdAt: item.createdAt,
    type: item.type,
    status: item.status,
  };
}

function publicGuestbook(item: ApprovedGuestbook): PublicCommunityIndex["guestbook"][number] {
  return {
    id: item.id,
    schemaVersion: item.schemaVersion,
    recordKind: "guestbook",
    message: item.message,
    ...(item.name ? { name: item.name } : {}),
    ...(item.url ? { url: item.url } : {}),
    ...(item.title ? { title: item.title } : {}),
    ...(item.excerpt ? { excerpt: item.excerpt } : {}),
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    ...(item.sourceLabel ? { sourceLabel: item.sourceLabel } : {}),
    createdAt: item.createdAt,
    status: item.status,
  };
}

function publicEvent(item: ApprovedEvent): PublicCommunityIndex["events"][number] {
  return {
    id: item.id,
    schemaVersion: item.schemaVersion,
    recordKind: "event",
    date: item.date,
    url: item.url,
    sourceLabel: item.sourceLabel || "参与者投稿",
    title: item.title || item.url,
    excerpt: item.excerpt || "",
    createdAt: item.createdAt,
    status: item.status,
  };
}

function publicMedia(item: ApprovedMedia): PublicCommunityIndex["media"][number] {
  return {
    id: item.id,
    schemaVersion: item.schemaVersion,
    recordKind: "media",
    kind: item.kind,
    url: `/api/media-submission?id=${encodeURIComponent(item.id)}`,
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    ...(item.title ? { title: item.title } : {}),
    ...(item.caption ? { caption: item.caption } : {}),
    ...(item.name ? { name: item.name } : {}),
    createdAt: item.createdAt,
    status: item.status,
  };
}

function sortPublicIndex(index: PublicCommunityIndex): PublicCommunityIndex {
  index.traces.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  index.guestbook.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  index.events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  index.media.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return index;
}

export function validPublicCommunityIndex(value: unknown): value is PublicCommunityIndex {
  const index = value as PublicCommunityIndex | null;
  return Boolean(index && index.version === 1 && Array.isArray(index.traces) && Array.isArray(index.guestbook) && Array.isArray(index.media) && Array.isArray(index.events));
}

/**
 * The public reader should not list every private object on every refresh.
 * Rebuild this small, sanitised index only when moderation changes the public set.
 */
export async function rebuildPublicCommunityIndex(): Promise<PublicCommunityIndex> {
  const approved = await listJson<ApprovedCommunityRecord>("submissions/approved/");
  const traces = approved
    .filter((item): item is ApprovedWitness => "url" in item && typeof item.url === "string")
    .map(publicWitness);
  const guestbook: PublicCommunityIndex["guestbook"] = [];
  const events = approved
    .filter((item): item is ApprovedEvent => item.recordKind === "event" && validDate(item.date) && typeof item.url === "string")
    .map(publicEvent);
  const media = approved
    .filter((item): item is ApprovedMedia => item.recordKind === "media" && Boolean(item.media?.pathname) && (item.kind === "image" || item.kind === "audio"))
    .map(publicMedia);
  const index: PublicCommunityIndex = sortPublicIndex({ version: 1, updatedAt: new Date().toISOString(), traces, guestbook, events, media });
  await writeJson("public/community-index.json", index);
  return index;
}

/**
 * Update the small public index from one moderation change. A full rebuild is
 * still available for recovery, but normal approvals no longer scan every
 * approved object in Blob.
 */
export async function updatePublicCommunityIndex(record: ApprovedCommunityRecord, action: "approve" | "decline") {
  const existing = await readJson<PublicCommunityIndex>("public/community-index.json");
  if (!validPublicCommunityIndex(existing)) return rebuildPublicCommunityIndex();
  const traces = existing.traces.filter((item) => item.id !== record.id);
  const guestbook = existing.guestbook.filter((item) => item.id !== record.id);
  const events = existing.events.filter((item) => item.id !== record.id);
  const media = existing.media.filter((item) => item.id !== record.id);
  if (action === "approve") {
    if (record.recordKind === "event") events.push(publicEvent(record));
    else if (record.recordKind === "media") media.push(publicMedia(record));
    else if ("url" in record && typeof record.url === "string") traces.push(publicWitness(record as ApprovedWitness));
  }
  const next = sortPublicIndex({ version: 1, updatedAt: new Date().toISOString(), traces, guestbook, events, media });
  await writeJson("public/community-index.json", next);
  return next;
}

export function validDate(value: string) {
  return /^2026-03-(1[6-9]|2[0-2])$/.test(value) && value >= DATE_FROM && value <= DATE_TO;
}

export function normaliseReferenceUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) parsed.port = "";
  return parsed.toString();
}

/** A warm-instance burst guard; no IP is persisted or returned. */
export function softSubmissionRateLimited(req: any) {
  const forwarded = req.headers?.["x-forwarded-for"] ?? req.headers?.["x-real-ip"];
  const source = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  if (!source) return false;
  const now = Date.now();
  for (const [key, entry] of submissionRate) if (now - entry.startedAt > SUBMISSION_RATE_WINDOW) submissionRate.delete(key);
  const current = submissionRate.get(source);
  if (!current || now - current.startedAt > SUBMISSION_RATE_WINDOW) { submissionRate.set(source, { startedAt: now, count: 1 }); return false; }
  current.count += 1;
  return current.count > SUBMISSION_RATE_MAX;
}
