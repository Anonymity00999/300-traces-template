import { del } from "@vercel/blob";
import { bodyOf, isAdmin, listJson, readJson, sendJson, updatePublicCommunityIndex, writeJson } from "./_archive.js";

type TraceType = "idea" | "article" | "answer";
type Submission = { id: string; recordKind?: "witness" | "guestbook" | "event" | "media"; participantKey?: string; url?: string; date?: string; sourceLabel?: string; publishedAt?: string; title?: string; excerpt?: string; reason?: string; message?: string; name?: string; createdAt: string; type?: TraceType; kind?: "image" | "audio"; media?: { pathname: string; contentType: string; bytes: number; durationSeconds?: number }; caption?: string; sourceRegion?: "global" | "mainland"; schemaVersion?: number; status: "pending" | "approved" | "not-used" };
type Feedback = { id: string; recordKind: "feedback"; rating?: number; message?: string; contact?: string; createdAt: string; status: "received" };

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (!isAdmin(req)) return sendJson(res, 401, { error: "审核钥匙不正确。" });
  if (req.method === "GET") return sendJson(res, 200, { submissions: (await listJson<Submission>("submissions/pending/")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), feedback: (await listJson<Feedback>("feedback/")).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500) });
  if (req.method !== "POST") return sendJson(res, 405, { error: "只允许审核动作。" });
  const input = bodyOf(req);
  const id = typeof input.id === "string" && /^[\w-]{20,80}$/.test(input.id) ? input.id : "";
  if (!id || (input.action !== "approve" && input.action !== "decline" && input.action !== "delete")) return sendJson(res, 400, { error: "这条痕迹无法被处理。" });
  if (input.action === "delete") {
    let pathname = "";
    let item: Submission | null = null;
    for (const folder of ["pending", "approved"]) {
      const candidatePath = `submissions/${folder}/${id}.json`;
      const candidate = await readJson<Submission>(candidatePath);
      if (candidate) { pathname = candidatePath; item = candidate; break; }
    }
    if (!pathname || !item) return sendJson(res, 404, { error: "没有找到这条资料。" });
    if (item.recordKind === "media" && item.media?.pathname) {
      try { await del(item.media.pathname); } catch { /* a missing media blob should not block record removal */ }
    }
    await del(pathname);
    if (pathname.includes("/approved/")) {
      try { await updatePublicCommunityIndex(item as any, "decline"); } catch { /* the next public read can rebuild the index */ }
    }
    return sendJson(res, 200, { ok: true, deleted: id });
  }
  const pendingPath = `submissions/pending/${id}.json`;
  const item = await readJson<Submission>(pendingPath);
  if (!item) return sendJson(res, 404, { error: "没有找到这条等待中的参考。" });
  const status = input.action === "approve" ? "approved" : "not-used";
  const type: TraceType = input.type === "idea" || input.type === "answer" ? input.type : "article";
  if (status === "approved") await writeJson(`submissions/approved/${id}.json`, item.recordKind === "guestbook" || item.recordKind === "event" || item.recordKind === "media" ? { ...item, status } : { ...item, type, status });
  else {
    await writeJson(`submissions/not-used/${id}.json`, { ...item, status });
    if (item.recordKind === "media" && item.media?.pathname) { try { await del(item.media.pathname); } catch { /* a missing blob should not block review */ } }
  }
  await del(pendingPath);
  try {
    if (status === "approved") await updatePublicCommunityIndex({ ...item, status, ...(item.recordKind === "witness" ? { type } : {}) } as any, "approve");
    else await updatePublicCommunityIndex(item as any, "decline");
  } catch { /* moderation remains durable; the next public read can rebuild */ }
  return sendJson(res, 200, { ok: true });
}
