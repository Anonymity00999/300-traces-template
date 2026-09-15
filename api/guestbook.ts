import { ARCHIVE_SCHEMA_VERSION, bodyOf, readJson, sendJson, softSubmissionRateLimited, submissionId, text, writeJson } from "./_archive.js";

type Feedback = { id: string; schemaVersion: number; recordKind: "feedback"; rating: number; message?: string; contact?: string; createdAt: string; status: "received" };

/** Kept at the old URL so existing deployments do not need a new serverless function. */
export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "这个入口只接住反馈。" });
  if (softSubmissionRateLimited(req)) return sendJson(res, 429, { error: "请稍后再留下反馈。" });
  const input = bodyOf(req);
  if (text(input.website, 200)) return sendJson(res, 202, { ok: true });
  const message = text(input.message, 1600);
  const contact = text(input.contact || input.name, 240);
  const rating = Math.round(Number(input.rating));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return sendJson(res, 400, { error: "请先选一个星级。" });
  const id = submissionId(req, input);
  const pathname = `feedback/${id}.json`;
  const previous = await readJson<Feedback>(pathname);
  if (previous?.recordKind === "feedback") return sendJson(res, 200, { ok: true, duplicate: true, message: "这条反馈已经收到。" });
  await writeJson(pathname, { id, schemaVersion: ARCHIVE_SCHEMA_VERSION, recordKind: "feedback", rating, ...(message ? { message } : {}), ...(contact ? { contact } : {}), createdAt: new Date().toISOString(), status: "received" } satisfies Feedback);
  return sendJson(res, 201, { ok: true, message: "反馈已经收到，不会公开显示。" });
}
