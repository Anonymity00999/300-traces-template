import { ARCHIVE_SCHEMA_VERSION, bodyOf, existingSubmission, listJson, normaliseReferenceUrl, sendJson, softSubmissionRateLimited, submissionId, text, validDate, writeJson } from "./_archive.js";
import { fetchReferenceMetadata, type ReferenceMetadata } from "./references.js";

type EventSubmission = { id: string; recordKind: "event"; schemaVersion: number; sourceRegion: "global" | "mainland"; participantKey?: string; date: string; url: string; sourceLabel: string; title: string; excerpt: string; reason: string; metadata?: ReferenceMetadata; createdAt: string; status: "pending" | "approved" | "not-used" };

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "只允许交来当天事件。" });
  const input = bodyOf(req);
  if (text(input.website, 120)) return sendJson(res, 202, { ok: true, message: "这条事件已经被放进等待接住的地方。" });
  const id = submissionId(req, input);
  const previous = await existingSubmission<EventSubmission>(id);
  if (previous?.recordKind === "event") return sendJson(res, 200, { ok: true, duplicate: true, message: "这条当天事件已经在等待接住的地方。" });
  if (softSubmissionRateLimited(req)) { res.setHeader("retry-after", "600"); return sendJson(res, 429, { error: "请让这条事件停一会儿，再继续交来。" }); }
  const date = text(input.date, 10);
  if (!validDate(date)) return sendJson(res, 400, { error: "请选择 2026 年 3 月 16–22 日中的一天。" });
  const rawUrl = text(input.url, 1000);
  let url = "";
  try { url = normaliseReferenceUrl(rawUrl); } catch { return sendJson(res, 400, { error: "请留下完整的事件来源链接。" }); }
  const title = text(input.title, 160);
  const excerpt = text(input.excerpt, 500);
  const reason = text(input.reason, 600);
  const sourceLabel = new URL(url).hostname.replace(/^www\./, "");
  const existing = await listJson<EventSubmission>("submissions/pending/");
  const approved = await listJson<EventSubmission>("submissions/approved/");
  if ([...existing, ...approved].some((item) => item.recordKind === "event" && item.date === date && item.url === url)) return sendJson(res, 409, { error: "这条当天事件已经在等待或被接住了。" });
  const ingestKey = req.headers?.["x-archive-ingest-key"];
  const isInternalIngest = typeof ingestKey === "string" && Boolean(process.env.ARCHIVE_ADMIN_KEY) && ingestKey === process.env.ARCHIVE_ADMIN_KEY;
  const metadata = await fetchReferenceMetadata(url);
  const participantKey = typeof input.participantKey === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(input.participantKey) ? input.participantKey : undefined;
  const submission: EventSubmission = {
    id,
    recordKind: "event",
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    sourceRegion: isInternalIngest ? "mainland" : "global",
    ...(participantKey ? { participantKey } : {}),
    date,
    url,
    sourceLabel,
    title: title || metadata.title || `未命名当天事件 · ${sourceLabel}`,
    excerpt: excerpt || metadata.excerpt || "",
    reason,
    metadata,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await writeJson(`submissions/pending/${submission.id}.json`, submission);
  return sendJson(res, 201, { ok: true, message: "这条事件已经收到，正在等待审核。" });
}
