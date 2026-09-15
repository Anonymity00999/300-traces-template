import { del, list } from "@vercel/blob";
import { listJson, readJson, rebuildPublicCommunityIndex, sendJson, text, type PublicCommunityIndex, validPublicCommunityIndex, writeJson } from "./_archive.js";

type CommunityTrace = { id: string; schemaVersion?: number; recordKind?: "witness"; url: string; publishedAt?: string; title: string; excerpt: string; createdAt: string; type?: "idea" | "article" | "answer"; status: "approved" };
type CommunityGuestbook = { id: string; schemaVersion?: number; recordKind: "guestbook"; message: string; name?: string; url?: string; title?: string; excerpt?: string; publishedAt?: string; sourceLabel?: string; createdAt: string; status: "approved" };
type CommunityEvent = { id: string; schemaVersion?: number; recordKind: "event"; date: string; url: string; sourceLabel?: string; title: string; excerpt: string; createdAt: string; status: "approved" };
type CommunityMedia = { id: string; schemaVersion?: number; recordKind: "media"; kind: "image" | "audio"; url: string; publishedAt?: string; title?: string; caption?: string; name?: string; createdAt: string; status: "approved" };

type WatchParticipant = { id: string; nickname: string; videoUrl?: string; joinedAt: string; lastSeenAt: string };
type WatchMessage = { id: string; participantId: string; nickname: string; message: string; createdAt: string };
type WatchStored<T> = { pathname: string; item: T };

const WATCH_ROOM_MAX_AGE = 24 * 60 * 60 * 1000;
const WATCH_PARTICIPANT_MAX_AGE = 12 * 60 * 60 * 1000;
const WATCH_MAX_MESSAGES = 200;
const WATCH_MAX_PARTICIPANTS = 40;
const watchRate = new Map<string, { startedAt: number; count: number }>();

function watchRoomCode(value: unknown) {
  const room = text(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{4,12}$/.test(room) ? room : "";
}

function watchParticipantId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,80}$/.test(value) ? value : "";
}

function watchExternalUrl(value: unknown) {
  const raw = text(value, 500);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch { return ""; }
}

function watchClientKey(req: any) {
  const forwarded = req.headers?.["x-forwarded-for"];
  return typeof forwarded === "string" ? forwarded.split(",")[0].trim().slice(0, 80) : "unknown";
}

function watchRateLimited(req: any) {
  const now = Date.now();
  const key = watchClientKey(req);
  const previous = watchRate.get(key);
  if (!previous || now - previous.startedAt > 10 * 60 * 1000) {
    watchRate.set(key, { startedAt: now, count: 1 });
    return false;
  }
  previous.count += 1;
  return previous.count > 120;
}

async function listWatchJson<T>(prefix: string): Promise<Array<WatchStored<T>>> {
  const found = await list({ prefix, limit: 250 });
  const items = await Promise.all(found.blobs.map(async (blob) => ({ pathname: blob.pathname, item: await readJson<T>(blob.pathname) })));
  return items.flatMap(({ pathname, item }) => item ? [{ pathname, item }] : []);
}

async function cleanWatchRoom(room: string) {
  const now = Date.now();
  const [participants, messages] = await Promise.all([
    listWatchJson<WatchParticipant>(`watch-rooms/${room}/participants/`),
    listWatchJson<WatchMessage>(`watch-rooms/${room}/messages/`),
  ]);
  const staleParticipants = participants.filter(({ item }) => now - new Date(item.lastSeenAt).getTime() > WATCH_PARTICIPANT_MAX_AGE);
  const staleMessages = messages.filter(({ item }) => now - new Date(item.createdAt).getTime() > WATCH_ROOM_MAX_AGE);
  const freshMessages = messages.filter(({ item }) => !staleMessages.some((entry) => entry.item.id === item.id)).sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
  const extraMessages = freshMessages.slice(WATCH_MAX_MESSAGES);
  await Promise.all([...staleParticipants, ...staleMessages, ...extraMessages].map(({ pathname }) => del(pathname).catch(() => undefined)));
}

async function watchRoomPayload(room: string) {
  await cleanWatchRoom(room);
  const [participants, messages] = await Promise.all([
    listJson<WatchParticipant>(`watch-rooms/${room}/participants/`),
    listJson<WatchMessage>(`watch-rooms/${room}/messages/`),
  ]);
  const orderedParticipants = participants
    .filter((item) => item.id && item.nickname)
    .sort((a, b) => a.nickname.localeCompare(b.nickname, "zh-Hans"))
    .slice(0, WATCH_MAX_PARTICIPANTS)
    .map(({ id, nickname, videoUrl, joinedAt }) => ({ id, nickname, ...(videoUrl ? { videoUrl } : {}), joinedAt }));
  const orderedMessages = messages
    .filter((item) => item.id && item.message)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-80);
  return { room, participants: orderedParticipants, messages: orderedMessages, retentionHours: 24 };
}

async function watchRoomHandler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (watchRateLimited(req)) { res.setHeader("retry-after", "600"); return sendJson(res, 429, { error: "这个房间需要安静一会儿，再继续进入。" }); }
  const input = req.method === "POST" && req.body && typeof req.body === "object" ? req.body : {};
  const room = watchRoomCode(req.query?.room || input.room);
  if (!room) return sendJson(res, 400, { error: "请留下 4–12 位房间码。" });
  res.setHeader("cache-control", "no-store");
  try {
    if (req.method === "GET") return sendJson(res, 200, await watchRoomPayload(room));
    if (req.method !== "POST") return sendJson(res, 405, { error: "这个房间只接住进入、留言和离开。" });
    const action = input.action === "message" || input.action === "leave" ? input.action : "join";
    const id = watchParticipantId(input.participantId) || crypto.randomUUID().replace(/-/g, "");
    const participantPath = `watch-rooms/${room}/participants/${id}.json`;
    if (action === "leave") {
      await del(participantPath).catch(() => undefined);
      return sendJson(res, 200, { ok: true, room });
    }
    const nickname = text(input.nickname, 40).replace(/[<>]/g, "");
    const existing = await readJson<WatchParticipant>(participantPath);
    if (action === "join") {
      if (!nickname) return sendJson(res, 400, { error: "请留下一个昵称。" });
      const now = new Date().toISOString();
      const videoUrl = watchExternalUrl(input.videoUrl);
      await writeJson(participantPath, { id, nickname, ...(videoUrl ? { videoUrl } : {}), joinedAt: existing?.joinedAt || now, lastSeenAt: now });
      return sendJson(res, 201, { ok: true, participantId: id, ...(await watchRoomPayload(room)) });
    }
    if (!existing) return sendJson(res, 404, { error: "这枚参与凭证已经离开房间，请重新进入。" });
    const now = new Date().toISOString();
    await writeJson(participantPath, { ...existing, lastSeenAt: now });
    const message = text(input.message, 280).replace(/[<>]/g, "");
    if (!message) return sendJson(res, 400, { error: "请先写下一句话。" });
    const messageId = crypto.randomUUID().replace(/-/g, "");
    await writeJson(`watch-rooms/${room}/messages/${messageId}.json`, { id: messageId, participantId: id, nickname: existing.nickname, message, createdAt: now });
    return sendJson(res, 201, { ok: true, ...(await watchRoomPayload(room)) });
  } catch {
    return sendJson(res, 503, { error: "这个临时房间暂时没有接住，请稍后再试。" });
  }
}

export default async function handler(req: any, res: any) {
  if (req.query?.watchRoom === "1") return watchRoomHandler(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "GET") return sendJson(res, 405, { error: "只允许读取已经接住的资料。" });
  if (req.query?.health === "1") {
    res.setHeader("cache-control", "no-store");
    return sendJson(res, 200, { ok: true, service: "300-traces-global", archiveSchemaVersion: 1, apiRevision: "source-unified-2026-09-15", publicReader: "ready", checkedAt: new Date().toISOString() });
  }
  // The public index is a small, sanitised read model. Let the edge and Blob
  // cache hold it briefly so each visible reader does not wake the store.
  res.setHeader("cache-control", "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
  let index = await readJson<PublicCommunityIndex>("public/community-index.json", { useCache: true });
  if (!validPublicCommunityIndex(index)) {
    try { index = await rebuildPublicCommunityIndex(); } catch {
      const items = await listJson<CommunityTrace | CommunityGuestbook | CommunityEvent | CommunityMedia>("submissions/approved/");
      const traces = items.filter((item): item is CommunityTrace => (item.recordKind === "witness" || !item.recordKind) && Boolean((item as CommunityTrace).url)).map(({ id, schemaVersion, recordKind, url, publishedAt, title, excerpt, createdAt, type, status }) => ({ id, schemaVersion, recordKind: recordKind || "witness", url, publishedAt, title: title || url, excerpt: excerpt || "", createdAt, type, status }));
      const guestbook: CommunityGuestbook[] = [];
      const events = items.filter((item): item is CommunityEvent => item.recordKind === "event" && Boolean((item as CommunityEvent).date) && Boolean((item as CommunityEvent).url)).map(({ id, schemaVersion, recordKind, date, url, sourceLabel, title, excerpt, createdAt, status }) => ({ id, schemaVersion, recordKind, date, url, sourceLabel: sourceLabel || "参与者投稿", title: title || url, excerpt: excerpt || "", createdAt, status }));
      const media = items.filter((item): item is CommunityMedia & { media: { pathname: string } } => item.recordKind === "media" && Boolean((item as any).media?.pathname)).map(({ id, schemaVersion, recordKind, kind, publishedAt, title, caption, name, createdAt, status }) => ({ id, schemaVersion, recordKind, kind, url: `/api/media-submission?id=${encodeURIComponent(id)}`, ...(publishedAt ? { publishedAt } : {}), ...(title ? { title } : {}), ...(caption ? { caption } : {}), ...(name ? { name } : {}), createdAt, status }));
      return sendJson(res, 200, { version: 1, updatedAt: new Date().toISOString(), traces, guestbook, events, media });
    }
  }
  const publicIndex = { ...index, guestbook: [] as CommunityGuestbook[] };
  const etag = `"community-${publicIndex.updatedAt}-${publicIndex.traces.length}-0-${publicIndex.events.length}-${publicIndex.media.length}"`;
  res.setHeader("etag", etag);
  const incomingTag = req.headers?.["if-none-match"];
  if (incomingTag === etag) return res.status(304).send("");
  return sendJson(res, 200, publicIndex);
}
