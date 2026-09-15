import { bodyOf, listJson, sendJson, softSubmissionRateLimited, validArchiveKey } from "./_archive.js";

import { safeWitness } from "../app/participant-data.js";

type Submission = {
  id: string;
  recordKind?: "witness" | "guestbook" | "event" | "media";
  participantKey?: string;
  url?: string;
  date?: string;
  sourceLabel?: string;
  publishedAt?: string;
  title?: string;
  excerpt?: string;
  reason?: string;
  message?: string;
  name?: string;
  createdAt: string;
  type?: "idea" | "article" | "answer";
  kind?: "image" | "audio";
  caption?: string;
  metadata?: { status: "fetched" | "unavailable" | "not-html"; fetchedAt: string; sourceDomain: string; finalUrl?: string; title?: string; excerpt?: string; publishedAt?: string; siteName?: string };
  status: "pending" | "approved" | "not-used";
  sourceRegion?: "global" | "mainland";
};

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "只允许取回自己的足迹与见证。" });
  if (softSubmissionRateLimited(req)) { res.setHeader("retry-after", "600"); return sendJson(res, 429, { error: "请让这份资料停一会儿，再继续取回。" }); }
  const input = bodyOf(req);
  const key = input.key;
  if (!validArchiveKey(key)) return sendJson(res, 400, { error: "阅读凭证无效。" });
  try {
    const groups = await Promise.all([
      listJson<Submission>("submissions/pending/"),
      listJson<Submission>("submissions/approved/"),
      listJson<Submission>("submissions/not-used/"),
    ]);
    const records = groups.flat().filter((item) => item.participantKey === key).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-500).map((item) => safeWitness(item as unknown as Record<string, unknown>));
    res.setHeader("cache-control", "no-store");
    return sendJson(res, 200, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      project: "300 traces / 300条痕迹",
      scope: "participant-self-export",
      privacy: "Only records linked to this anonymous reading pass are included. No private review fields or media bytes are included.",
      records,
    });
  } catch {
    return sendJson(res, 503, { error: "自己的见证暂时没有取回；本机留下的资料仍然可以下载。" });
  }
}
