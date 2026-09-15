import { bodyOf, isAdmin, readJson, sendJson, text, writeJson } from "./_archive.js";
import { normalizeContentOrder, normalizeRelatedLinks, type RelatedLink } from "../app/data/site-settings.js";

type CopyBlock = Record<string, string>;
export type SiteSettings = { zh?: CopyBlock; en?: CopyBlock; backgroundOpacity?: number; vimeoUrl?: string; zhihuVideoUrl?: string; bilibiliVideoUrl?: string; contentOrder?: string[]; relatedLinks?: RelatedLink[] };

function copyBlock(value: unknown): CopyBlock {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const copy = Object.fromEntries(Object.entries(source)
    .filter(([key]) => /^[A-Za-z][A-Za-z0-9]{0,40}$/.test(key))
    .map(([key, value]) => [key, text(value, 600)]));
  const includesAny = (value: string | undefined, ...parts: string[]) => Boolean(value && parts.some((part) => value.includes(part)));
  if (includesAny(copy.exportIntro, "同一个出口", "share one quiet exit", "your own device")) copy.exportIntro = "";
  if (includesAny(copy.submitIntro, "留下一条链接", "自动整理", "私密审核处", "private place", "private review", "organized automatically", "random encounter")) copy.submitIntro = copy.submitIntro?.includes("private") || copy.submitIntro?.includes("random") ? "Only the link is needed; the other details are optional. It appears in the guestbook, not among the random traces." : "只需一个链接；其他信息可选。提交后会出现在留言区，不进入随机痕迹区。";
  if (includesAny(copy.linksIntro, "彼此留下入口", "leave their entrances here")) copy.linksIntro = copy.linksIntro?.includes("leave") ? "Earlier works and community-made projects." : "以前的作品与社区创作。";
  if (includesAny(copy.periodIntro, "图片先让这一周", "Images let this week return first")) copy.periodIntro = "";
  if (includesAny(copy.periodImageNote, "图片按日期进入", "已经遇见的图片", "Images enter by date", "already encountered")) copy.periodImageNote = copy.periodImageNote?.includes("Images") ? "A rotation by date." : "按日期轮动。";
  if (includesAny(copy.periodImageEmpty, "文章可以先继续阅读", "articles from this day remain below")) copy.periodImageEmpty = copy.periodImageEmpty?.includes("articles") ? "No image has been received into this day." : "这一天还没有图片。";
  if (includesAny(copy.mediaIntro, "影像只是另一条", "film is another way")) copy.mediaIntro = "";
  if (includesAny(copy.periodSoundContinue, "换日期时", "声音仍留在水面上", "When the date changes", "sound stays on the water", "sound remains on the water")) copy.periodSoundContinue = copy.periodSoundContinue?.includes("When") || copy.periodSoundContinue?.includes("sound") ? "Sound stays on the water." : "声音留在水面上。";
  if (includesAny(copy.materialsIntro, "审核钥匙", "review key")) copy.materialsIntro = copy.materialsIntro?.includes("review") ? "A reusable project structure, data format and selected website references." : "一份可直接复用的项目结构、数据格式与网站参考。";
  if (includesAny(copy.materialsSourceNote, "源码包", "source package", "审核钥匙", "review key")) copy.materialsSourceNote = "";
  if (includesAny(copy.sent, "私密审核", "private review")) copy.sent = copy.sent?.includes("private") ? "Received. It will appear in the guestbook." : "已经收到。它会出现在留言区。";
  if (includesAny(copy.consent, "私密审核", "private review")) copy.consent = copy.consent?.includes("private") ? "I understand this link will appear publicly in the guestbook, not among the random traces." : "我知道这条链接会公开出现在留言区，不进入随机痕迹区。";
  if (copy.submissionPassNote?.includes("更多入口") || copy.submissionPassNote?.includes("Further passages")) copy.submissionPassNote = copy.submissionPassNote.replace(/更多入口/g, "友情链接").replace(/Further passages/g, "Related links");
  if (["被接住的参考", "References already received", "近来提交的见证", "Recent witnesses"].includes(copy.community || "")) copy.community = copy.community === "被接住的参考" || copy.community === "近来提交的见证" ? "实时新增" : "Newly received";
  if (["它们已经被接住，也会被后来的人遇见。", "They have been received here, and may be encountered by someone arriving later."].includes(copy.communityIntro || "")) copy.communityIntro = copy.communityIntro === "它们已经被接住，也会被后来的人遇见。" ? "已经接住的内容，会在这里出现。" : "Received pieces appear here.";
  for (const key of ["progressScope", "periodSoundNote", "periodSoundContinue"]) copy[key] = "";
  return copy;
}

function vimeoUrl(value: unknown) {
  const url = text(value, 300).trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /(^|\.)vimeo\.com$/i.test(parsed.hostname) ? parsed.toString() : "";
  } catch { return ""; }
}

function zhihuVideoUrl(value: unknown) {
  const url = text(value, 500).trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /(^|\.)zhihu\.com$/i.test(parsed.hostname) && /\/(?:video|zvideo)(?:\/|$)/i.test(parsed.pathname) ? parsed.toString() : "";
  } catch { return ""; }
}

function bilibiliVideoUrl(value: unknown) {
  const url = text(value, 500).trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    if (/(^|\.)bilibili\.com$/i.test(parsed.hostname)) return /^\/video\//i.test(parsed.pathname) ? parsed.toString() : "";
    return /(^|\.)b23\.tv$/i.test(parsed.hostname) ? parsed.toString() : "";
  } catch { return ""; }
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method === "GET") {
    res.setHeader("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=900");
    const stored = await readJson<SiteSettings>("settings/site-copy.json", { useCache: true }) ?? {};
    return sendJson(res, 200, { ...stored, ...(stored.relatedLinks ? { relatedLinks: normalizeRelatedLinks(stored.relatedLinks) } : {}), ...(stored.zh ? { zh: copyBlock(stored.zh) } : {}), ...(stored.en ? { en: copyBlock(stored.en) } : {}) });
  }
  if (req.method !== "POST" || !isAdmin(req)) return sendJson(res, 401, { error: "这里需要你的审核钥匙。" });
  const input = bodyOf(req);
  const previous = await readJson<SiteSettings>("settings/site-copy.json") ?? {};
  const opacityInput = Number(input.backgroundOpacity);
  const settings: SiteSettings = {
    zh: input.zh === undefined ? copyBlock(previous.zh) : copyBlock(input.zh),
    en: input.en === undefined ? copyBlock(previous.en) : copyBlock(input.en),
    vimeoUrl: input.vimeoUrl === undefined ? previous.vimeoUrl : vimeoUrl(input.vimeoUrl),
    zhihuVideoUrl: input.zhihuVideoUrl === undefined ? previous.zhihuVideoUrl : zhihuVideoUrl(input.zhihuVideoUrl),
    bilibiliVideoUrl: input.bilibiliVideoUrl === undefined ? previous.bilibiliVideoUrl : bilibiliVideoUrl(input.bilibiliVideoUrl),
    backgroundOpacity: input.backgroundOpacity === undefined ? previous.backgroundOpacity ?? 0.15 : Number.isFinite(opacityInput) ? Math.max(0, Math.min(0.35, opacityInput)) : 0.15,
    contentOrder: normalizeContentOrder(input.contentOrder === undefined ? previous.contentOrder : input.contentOrder),
    relatedLinks: normalizeRelatedLinks(input.relatedLinks === undefined ? previous.relatedLinks : input.relatedLinks),
  };
  await writeJson("settings/site-copy.json", settings);
  return sendJson(res, 200, settings);
}
