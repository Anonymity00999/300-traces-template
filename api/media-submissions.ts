import { del, put } from "@vercel/blob";
import { ARCHIVE_SCHEMA_VERSION, bodyOf, existingSubmission, sendJson, softSubmissionRateLimited, submissionId, text, validDate, writeJson } from "./_archive.js";

const IMAGE_LIMIT = 900_000;
const AUDIO_LIMIT = 1_000_000;
const DATA_URL_LIMIT = 1_800_000;
const AUDIO_SECONDS_LIMIT = 30;
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav"]);

function decodeDataUrl(value: string) {
  if (value.length > DATA_URL_LIMIT) return null;
  const match = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match || !allowed.has(match[1])) return null;
  const bytes = Buffer.from(match[2], "base64");
  return { contentType: match[1], bytes };
}

function extension(contentType: string) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/webm": "webm", "audio/wav": "wav" } as Record<string, string>)[contentType] || "bin";
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "只允许交来一份照片或声音。" });
  const input = bodyOf(req);
  if (text(input.website, 120)) return sendJson(res, 202, { ok: true, message: "这份媒体已经被放进等待接住的地方。" });
  const id = submissionId(req, input);
  const previous = await existingSubmission<{ id: string; recordKind: string }>(id);
  if (previous?.recordKind === "media") return sendJson(res, 200, { ok: true, duplicate: true, message: "这份媒体已经在等待被接住。" });
  if (softSubmissionRateLimited(req)) { res.setHeader("retry-after", "600"); return sendJson(res, 429, { error: "请让这份媒体停一会儿，再继续交来。" }); }
  const kind = input.kind === "audio" ? "audio" : input.kind === "image" ? "image" : "";
  const parsed = decodeDataUrl(text(input.dataUrl, DATA_URL_LIMIT));
  if (!kind || !parsed) return sendJson(res, 400, { error: "请交来一份 JPG、PNG、WebP 图片或音频文件。" });
  if (kind === "image" && !parsed.contentType.startsWith("image/")) return sendJson(res, 400, { error: "图片入口只接住图片文件。" });
  if (kind === "audio" && !parsed.contentType.startsWith("audio/")) return sendJson(res, 400, { error: "声音入口只接住音频文件。" });
  const limit = kind === "image" ? IMAGE_LIMIT : AUDIO_LIMIT;
  if (parsed.bytes.length > limit) return sendJson(res, 400, { error: kind === "image" ? "图片压缩后仍超过 900 KB，请换一张较小的图片。" : "声音不能超过 1 MB。" });
  const durationSeconds = Number(input.durationSeconds);
  if (kind === "audio" && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > AUDIO_SECONDS_LIMIT)) return sendJson(res, 400, { error: "声音需要短于 30 秒。" });
  const publishedAt = text(input.publishedAt, 10);
  if (publishedAt && !validDate(publishedAt)) return sendJson(res, 400, { error: "如果留下日期，它需在 2026 年 3 月 16–22 日之间。" });
  const pathname = `media-submissions/pending/${id}.${extension(parsed.contentType)}`;
  const participantKey = typeof input.participantKey === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(input.participantKey) ? input.participantKey : undefined;
  const record = { id, recordKind: "media" as const, schemaVersion: ARCHIVE_SCHEMA_VERSION, sourceRegion: "global" as const, ...(participantKey ? { participantKey } : {}), kind, media: { pathname, contentType: parsed.contentType, bytes: parsed.bytes.length, ...(kind === "audio" ? { durationSeconds: Math.round(durationSeconds * 10) / 10 } : {}) }, ...(publishedAt ? { publishedAt } : {}), ...(text(input.title, 160) ? { title: text(input.title, 160) } : {}), ...(text(input.caption, 300) ? { caption: text(input.caption, 300) } : {}), ...(text(input.name, 60) ? { name: text(input.name, 60) } : {}), createdAt: new Date().toISOString(), status: "pending" as const };
  try {
    await put(pathname, parsed.bytes, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: parsed.contentType, cacheControlMaxAge: 300 });
    await writeJson(`submissions/pending/${id}.json`, record);
  } catch {
    try { await del(pathname); } catch { /* cleanup is best effort */ }
    return sendJson(res, 503, { error: "这份媒体暂时没有被接住，请稍后再试。" });
  }
  return sendJson(res, 201, { ok: true, message: "这份媒体已经收到，正在等待被接住。" });
}
