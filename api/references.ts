// @ts-nocheck -- the legacy ingestion implementation is retained below an unreachable retirement response.
import { ARCHIVE_SCHEMA_VERSION, bodyOf, existingSubmission, listJson, normaliseReferenceUrl, sendJson, softSubmissionRateLimited, submissionId, text, updatePublicCommunityIndex, validDate, writeJson } from "./_archive.js";

export type ReferenceMetadata = {
  status: "fetched" | "unavailable" | "not-html";
  fetchedAt: string;
  sourceDomain: string;
  finalUrl?: string;
  title?: string;
  excerpt?: string;
  publishedAt?: string;
  siteName?: string;
};

const MAX_HTML_BYTES = 160_000;
const FETCH_TIMEOUT_MS = 2_800;

function cleanMetadata(value: string, max: number) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function decodeMetadataEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function metadataAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? cleanMetadata(decodeMetadataEntities(match[1]), 1_000) : "";
}

function metadataDateOnly(value: string) {
  return value.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] || "";
}

function unsafeMetadataHost(hostname: string) {
  const host = hostname.toLowerCase().replace("[", "").replace("]", "");
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function metadataResponseText(response: Response) {
  if (!response.body) return (await response.text()).slice(0, MAX_HTML_BYTES);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let size = 0;
  try {
    while (size < MAX_HTML_BYTES) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const remaining = MAX_HTML_BYTES - size;
      const value = chunk.value.slice(0, remaining);
      result += decoder.decode(value, { stream: value.length < chunk.value.length ? false : true });
      size += value.length;
      if (value.length < chunk.value.length) break;
    }
  } finally {
    try { await reader.cancel(); } catch { /* best effort */ }
  }
  return result;
}

function parseReferenceMetadata(html: string) {
  const values = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = metadataAttribute(tag, "property") || metadataAttribute(tag, "name") || metadataAttribute(tag, "itemprop");
    const value = metadataAttribute(tag, "content");
    if (key && value && !values.has(key.toLowerCase())) values.set(key.toLowerCase(), value);
  }
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const timeMatch = html.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  const title = cleanMetadata(decodeMetadataEntities(values.get("og:title") || values.get("twitter:title") || (titleMatch?.[1] || "")), 160);
  const excerpt = cleanMetadata(decodeMetadataEntities(values.get("og:description") || values.get("description") || values.get("twitter:description") || ""), 500);
  const publishedAt = metadataDateOnly(values.get("article:published_time") || values.get("datepublished") || values.get("date") || timeMatch?.[1] || "");
  const siteName = cleanMetadata(decodeMetadataEntities(values.get("og:site_name") || ""), 120);
  return { title, excerpt, publishedAt, siteName };
}

export async function fetchReferenceMetadata(rawUrl: string): Promise<ReferenceMetadata> {
  const fetchedAt = new Date().toISOString();
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return { status: "unavailable", fetchedAt, sourceDomain: "" }; }
  const sourceDomain = parsed.hostname.replace(/^www\./i, "");
  const fallback = { status: "unavailable" as const, fetchedAt, sourceDomain };
  if (unsafeMetadataHost(parsed.hostname)) return fallback;
  try {
    const response = await fetch(parsed.toString(), {
      headers: { accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1", "user-agent": "300-traces-reference-organizer/1" },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return fallback;
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) return { ...fallback, status: "not-html" };
    const meta = parseReferenceMetadata(await metadataResponseText(response));
    return {
      status: "fetched",
      fetchedAt,
      sourceDomain,
      finalUrl: response.url || parsed.toString(),
      ...(meta.title ? { title: meta.title } : {}),
      ...(meta.excerpt ? { excerpt: meta.excerpt } : {}),
      ...(meta.publishedAt ? { publishedAt: meta.publishedAt } : {}),
      ...(meta.siteName ? { siteName: meta.siteName } : {}),
    };
  } catch { return fallback; }
}

type Submission = { id: string; recordKind: "witness"; schemaVersion: number; sourceRegion: "global" | "mainland"; participantKey?: string; url: string; publishedAt?: string; title: string; excerpt: string; reason: string; metadata?: ReferenceMetadata; status: "pending" | "approved" | "not-used" };

function publicGuestbookReference(submission: Submission) {
  return {
    ...submission,
    recordKind: "guestbook" as const,
    message: submission.reason || submission.excerpt || "参与者交来了一条参考。",
    sourceLabel: "参与者见证",
    status: "approved" as const,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "这个旧入口已经收起。" });
  return sendJson(res, 410, { error: "提交见证入口已经收起，请使用反馈入口。" });
  /* Legacy implementation below is unreachable. References must not auto-publish. */
  const input = bodyOf(req);
  if (text(input.website, 120)) return sendJson(res, 202, { ok: true, message: "这条参考已经被放进等待接住的地方。" });
  const id = submissionId(req, input);
  const previous = await existingSubmission<{ id: string; recordKind?: string }>(id);
  if (previous?.recordKind === "witness" || previous?.recordKind === "guestbook") return sendJson(res, 200, { ok: true, duplicate: true, message: "这条参考已经在留言区，或正在交来。" });
  const ingestKey = req.headers?.["x-archive-ingest-key"];
  const isInternalIngest = typeof ingestKey === "string" && Boolean(process.env.ARCHIVE_ADMIN_KEY) && ingestKey === process.env.ARCHIVE_ADMIN_KEY;
  if (!isInternalIngest && softSubmissionRateLimited(req)) { res.setHeader("retry-after", "600"); return sendJson(res, 429, { error: "请让这条参考停一会儿，再继续交来。" }); }
  const rawUrl = text(input.url, 1000);
  const submittedPublishedAt = text(input.publishedAt, 10);
  const title = text(input.title, 160);
  const excerpt = text(input.excerpt, 500);
  const reason = text(input.reason, 600);
  let url = "";
  try { url = normaliseReferenceUrl(rawUrl); } catch { return sendJson(res, 400, { error: "请留下完整的文章链接。" }); }
  if (submittedPublishedAt && !validDate(submittedPublishedAt)) return sendJson(res, 400, { error: "如果留下日期，它需在 2026 年 3 月 16–22 日之间。" });
  const source = new URL(url).hostname.replace(/^www\./, "");
  const existing = await Promise.all([
    listJson<Submission>("submissions/pending/"),
    listJson<Submission>("submissions/approved/"),
  ]);
  if (existing.flat().some((item) => { try { return normaliseReferenceUrl(item.url) === url; } catch { return item.url === url; } })) return sendJson(res, 409, { error: "这条链接已经在档案里等待或被接住了。" });
  const metadata = await fetchReferenceMetadata(url);
  const detectedDate = metadata.publishedAt && validDate(metadata.publishedAt) ? metadata.publishedAt : "";
  const participantKey = typeof input.participantKey === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(input.participantKey) ? input.participantKey : undefined;
  const publishedAt = submittedPublishedAt || detectedDate;
  const submission: Submission = { id, recordKind: "witness", schemaVersion: ARCHIVE_SCHEMA_VERSION, sourceRegion: isInternalIngest ? "mainland" : "global", ...(participantKey ? { participantKey } : {}), url, ...(publishedAt ? { publishedAt } : {}), title: title || metadata.title || `未命名参考 · ${source}`, excerpt: excerpt || metadata.excerpt || "", reason, metadata, createdAt: new Date().toISOString(), status: "approved" };
  const publicRecord = publicGuestbookReference(submission);
  await writeJson(`submissions/approved/${id}.json`, publicRecord);
  try { await updatePublicCommunityIndex(publicRecord as any, "approve"); } catch { /* the next public read can rebuild the index */ }
  return sendJson(res, 201, { ok: true, message: "这条参考已经出现在留言区，不会进入随机痕迹。" });
}
