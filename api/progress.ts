import { bodyOf, readJson, sendJson, validArchiveKey, writeJson } from "./_archive.js";

import { cleanIds, mergeOpeningTimes, type OpeningTimes } from "../app/participant-data.js";
type Progress = { ids?: string[]; browsingData?: { ids: string[]; periodImageIds: string[]; periodArticleIds: string[] }; readingTime?: OpeningTimes };

export default async function handler(req: any, res: any) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return sendJson(res, 405, { error: "只允许取回或保存足迹。" });
  const input = bodyOf(req);
  const key = input.key;
  if (!validArchiveKey(key)) return sendJson(res, 400, { error: "阅读凭证无效。" });
  try {
    const pathname = `progress/${key}.json`;
    const saved = await readJson<Progress>(pathname);
    const incoming: Progress = input.action === "read" ? {} : input;
    const browsingData = {
      ids: cleanIds([...cleanIds(saved?.browsingData?.ids || saved?.ids), ...cleanIds(incoming.browsingData?.ids || incoming.ids)]),
      periodImageIds: cleanIds([...cleanIds(saved?.browsingData?.periodImageIds), ...cleanIds(incoming.browsingData?.periodImageIds)]),
      periodArticleIds: cleanIds([...cleanIds(saved?.browsingData?.periodArticleIds), ...cleanIds(incoming.browsingData?.periodArticleIds)]),
    };
    const readingTime = mergeOpeningTimes(saved?.readingTime, incoming.readingTime);
    if (input.action !== "read") await writeJson(pathname, { userCode: key, browsingData, readingTime });
    return sendJson(res, 200, { ids: browsingData.ids, browsingData, readingTime });
  } catch {
    return sendJson(res, 503, { error: "足迹暂时留在此设备。" });
  }
}
