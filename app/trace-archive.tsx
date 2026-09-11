"use client";

import { CSSProperties, FormEvent, MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { initialTraceData, type Trace, type TraceType } from "./data/traces";
import { ARCHIVE_CONFIG } from "./data/archive-config";
import { PERIOD_IMAGES } from "./data/period-images";
import { PERIOD_AUDIO, type PeriodAudio } from "./data/period-audio";
import { PERIOD_EVENTS } from "./data/period-events";
import publicSnapshot from "./data/public-snapshot.json";
import { normalizeContentOrder, normalizeRelatedLinks, type ManagedContentId, type RelatedLink } from "./data/site-settings";
import { archiveRequest, archiveRequestWithEndpoint, IS_MAINLAND_BUILD, readCommunity, resolveMediaPath, type CommunityEvent, type CommunityGuestbook, type CommunityTrace } from "./archive-service";
import { flushQueuedSubmissions, queueSubmission, removeQueuedSubmission, retryableResponse, withSubmissionId, type QueuedSubmission, type SubmissionBody } from "./submission-queue";
import { safeBilibiliVideoUrl, safeVimeoUrl, safeZhihuVideoUrl, vimeoEmbedUrl } from "./media";

const READ_KEY = "trace-archive-read-v2";
const PERIOD_IMAGE_READ_KEY = "trace-archive-period-image-read-v1";
const PERIOD_ARTICLE_READ_KEY = "trace-archive-period-article-read-v1";
const PASSPORT_KEY = "trace-archive-passport-v1";
const PASSPORT_SEEN_KEY = "trace-archive-passport-seen-v1";
const SUBMISSION_HISTORY_KEY = "trace-archive-submission-history-v1";
const LOCALE_KEY = "trace-archive-locale-v1";
const PERIOD_DATES = ARCHIVE_CONFIG.period.dates;
const INITIAL_PERIOD_DATE = PERIOD_IMAGES.find((image) => image.status === "approved")?.date || PERIOD_DATES[0];
const TYPE_LABELS: Record<TraceType, string> = { idea: "想法", article: "文章", answer: "回答" };
const PUBLIC_ARCHIVE_URL = import.meta.env.VITE_PUBLIC_ARCHIVE_URL || "";
function localRead(key: string) {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; }
}
function localWrite(key: string, value: string) {
  try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); } catch { /* the in-memory copy remains usable */ }
}
function localStringArray(key: string) {
  try {
    const value = JSON.parse(localRead(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
type LocalSubmission = { id: string; path: string; recordKind: "witness" | "event" | "guestbook" | "media" | "feedback"; createdAt: string; status: "queued" | "pending" | "approved"; record: Record<string, unknown> };
function localSubmissionHistory(): LocalSubmission[] {
  try {
    const value = JSON.parse(localRead(SUBMISSION_HISTORY_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is LocalSubmission => Boolean(item && typeof item.id === "string" && typeof item.path === "string" && item.record && typeof item.record === "object")) : [];
  } catch { return []; }
}
function submissionKind(path: string): LocalSubmission["recordKind"] {
  if (path.includes("feedback")) return "feedback";
  if (path.includes("event-submissions")) return "event";
  if (path.includes("guestbook")) return "guestbook";
  if (path.includes("media-submissions")) return "media";
  return "witness";
}
function rememberLocalSubmission(path: string, id: string, body: SubmissionBody, status: LocalSubmission["status"]) {
  const kind = submissionKind(path);
  const record = Object.fromEntries(Object.entries(body).filter(([key]) => !["dataUrl", "participantKey", "website", "submissionId"].includes(key)));
  const history = localSubmissionHistory().filter((item) => item.id !== id);
  history.push({ id, path, recordKind: kind, createdAt: new Date().toISOString(), status, record });
  localWrite(SUBMISSION_HISTORY_KEY, JSON.stringify(history.slice(-100)));
}
type Filter = "all" | TraceType;
type Locale = "zh" | "en";
type StartupPhase = "show" | "leaving" | "done";
type EditableCopy = Record<string, string | undefined>;
type SiteSettings = { zh?: EditableCopy; en?: EditableCopy; backgroundOpacity?: number; vimeoUrl?: string; zhihuVideoUrl?: string; bilibiliVideoUrl?: string; contentOrder?: string[]; relatedLinks?: RelatedLink[] };
type TimeGesture = "date" | "encounter" | "read" | "sound" | "offer" | "restore" | "language" | "export";
type TimeEcho = { gesture: TimeGesture; motif: "sand" | "candle" | "both"; seed: number; tilt: number };
type ReadableKind = "trace" | "image" | "event" | "audio" | "link" | "film" | "guestbook";
let activePageCopy: EditableCopy | undefined;
const TIME_GESTURE_COPY: Record<TimeGesture, string> = { date: "timeGestureDate", encounter: "timeGestureEncounter", read: "timeGestureRead", sound: "timeGestureSound", offer: "timeGestureOffer", restore: "timeGestureRestore", language: "timeGestureLanguage", export: "timeGestureExport" };
function timeGestureLabel(gesture: TimeGesture, text: Record<string, string>) { return text[TIME_GESTURE_COPY[gesture]] || text.timeGestureEncounter; }

const copy = {
  zh: {
    archive: "300条痕迹", startup: "档案正在靠近…", device: "云端正在接住", qr: "现场二维码", qrTitle: "让它在现场被遇见", qrIntro: "请用手机相机扫描；它会带你回到此刻的阅读入口。", qrDownload: "下载二维码", qrPreparing: "正在留下入口…", eyebrow: "一份可被遇见的阅读档案", heading: <>慢一点，<em>遇见</em>一条痕迹。</>, intro: (count: number) => `这里有 ${count} 个被留下的片段。你可以随机遇见，也可以沿着某一种形式靠近它们。`, footprint: "你的阅读足迹", met: "已经与你相遇", held: "的痕迹已经被你接住", cloud: "足迹已在云端留下一份副本", next: "下一次靠近", all: "全部痕迹", status: "真实档案 · 可继续补入", open: "打开原文", read: "标记为读过", readAlready: "已经读过", draw: "遇见一条未读痕迹", note: "默认优先把尚未读过的痕迹交到你手里。", footer: "阅读是一种接住。", offer: "交来一条参考", passport: "取回 / 保存阅读凭证", original: "中文原文", translationNote: "保留原文；此浏览器暂不能生成英文译文。", translateLoading: "正在靠近英文…", source: "新的参考", labelIdea: "想法", labelArticle: "文章", labelAnswer: "回答", labelImage: "图片", labelEvent: "事件", labelAudio: "声音", labelFilm: "影像", labelLink: "入口", progressScope: "总进度包含档案文本、时间层图片、事件、声音、影像与入口；“遇见”不等于“读过”。", submitTitle: "交来一条参考", submitIntro: "只需一个链接；其他信息可选。", link: "文章链接", date: "发布日期", title: "标题", excerpt: "短摘录", reason: "为什么想把它交来", consent: "我理解：它只会先被私密审核，不会自动公开。", send: "把它交来", close: "暂时收起", sending: "正在放下…", sent: "已经收到。它正在等待被接住。", queued: "入口暂时没有接住；这份资料已保存在此设备，稍后会继续交来。", passportTitle: "一枚阅读凭证", passportIntro: "保存这串凭证。清除浏览记录或换设备后，用它可以取回你的足迹。", restore: "取回足迹", copy: "复制", copied: "已复制", restoreLabel: "输入你保存的阅读凭证", restoreButton: "接回足迹", restored: "足迹已经回到这里。", error: "暂时没有接住，请稍后再试。", imageAlt: "背景中的一条痕迹", audio: "接住声音", silence: "放回安静", community: "实时新增", communityIntro: "已经接住的内容，会在这里出现。", linksTitle: "一些相遇", linksIntro: "以前的作品与社区创作。", linksWork: "以前的作品", linksCommunity: "社区创作", linksOpen: "打开链接", linksEmpty: "链接还在等待被放下。", periodTitle: "时间层 · 2026.03.16–22", periodHeading: "回到那一周", periodIntro: "", periodCount: "条痕迹", periodEmpty: "这一天还没有留下可显示的片段。", periodImageTitle: "图片轮动层", periodImageNote: "按日期轮动。", periodImageRandom: "遇见另一张图片", periodImageOpen: "打开图片来源", periodImageCredit: "来源 / 说明", periodImageEmpty: "这一天还没有图片。", periodImageSeen: "已经遇见", periodEventsTitle: "这一天，也发生了", periodEventsNote: "把新闻、公共日历、天文与生态信号并置；它不是一份完整新闻摘要。", periodEventEmpty: "这一天暂时没有被收进来的事件。", periodEventOpen: "打开来源", eventOffer: "投稿当天事件", eventOfferIntro: "留下日期与来源链接；其余可以空着。审核通过后，它会进入这一天。", eventLink: "来源链接", eventDate: "发生日期", eventTitle: "事件标题", eventExcerpt: "简短说明", eventReason: "为什么交来", eventSend: "交来这一天", eventSent: "已经收到，正在等待审核。", vimeo: "观看影像", vimeoOpen: "在 Vimeo 中打开", mediaTitle: "影像入口", mediaIntro: "", vimeoLabel: "Vimeo 影像", zhihuLabel: "知乎视频备用入口", mediaLoading: "影像正在靠近…", mediaUnavailable: "影像此刻没有接住。", mediaFallback: "可以改从外部入口打开；如果仍不可达，文字档案仍然可以继续。", mediaRetry: "再试一次", mediaOpen: "打开外部入口",
  },
  en: {
    archive: "300 traces", startup: "The archive is approaching…", device: "Held in the cloud", qr: "On-site QR", qrTitle: "Let it be encountered here", qrIntro: "Scan with your phone camera to return to this reading entrance.", qrDownload: "Download QR code", qrPreparing: "Leaving an entrance…", eyebrow: "An archive made to be encountered", heading: <>Slow down. <em>Meet</em> a trace.</>, intro: (count: number) => `There are ${count} fragments left here. Encounter one at random, or move closer through a chosen form.`, footprint: "Your reading traces", met: "Already met", held: "of the archive has been received by you", cloud: "A quiet copy of your traces is held in the cloud", next: "The next approach", all: "All traces", status: "A living archive · open to additions", open: "Open original", read: "Mark as read", readAlready: "Already read", draw: "Meet an unread trace", note: "An unread trace is offered first, whenever possible.", footer: "Reading is a way of receiving.", offer: "Offer a reference", passport: "Recover / keep a reading pass", original: "Chinese original", translationNote: "The original remains; this browser cannot make an English rendering yet.", translateLoading: "Approaching English…", source: "A new reference", labelIdea: "Idea", labelArticle: "Article", labelAnswer: "Answer", labelImage: "Image", labelEvent: "Event", labelAudio: "Sound", labelFilm: "Moving image", labelLink: "Passage", progressScope: "The total includes archive texts, dated images, events, sound, moving image and passages; encountering is not the same as reading.", submitTitle: "Offer a reference", submitIntro: "It waits in a private place first. Only a reviewed reference may enter the random encounter.", link: "Article link", date: "Publication date", title: "Title", excerpt: "Short excerpt", reason: "Why offer it here?", consent: "I understand: this is private for review and will not be published automatically.", send: "Offer it", close: "Close for now", sending: "Placing it…", sent: "Received. It is waiting to be held.", queued: "The entrance is quiet for now; this is saved on this device and will be offered again later.", passportTitle: "A reading pass", passportIntro: "Keep this pass. You can use it to recover your traces after clearing browser data or changing devices.", restore: "Recover traces", copy: "Copy", copied: "Copied", restoreLabel: "Enter your saved reading pass", restoreButton: "Bring traces back", restored: "Your traces have returned.", error: "It could not be held just now. Please try again.", imageAlt: "A trace behind the page", audio: "Receive sound", silence: "Return to quiet", community: "Newly received", communityIntro: "Received pieces appear here.", linksTitle: "Further encounters", linksIntro: "Earlier works and community-made projects leave their entrances here.", linksWork: "Earlier works", linksCommunity: "Community-made", linksOpen: "Open link", linksEmpty: "Links are still waiting to be placed here.", periodTitle: "Time layer · 16–22 March 2026", periodHeading: "Return to that week", periodIntro: "Images let this week return first; the articles remain below by date.", periodCount: "traces", periodEmpty: "Nothing from this day is ready to show yet.", periodImageTitle: "Images in rotation", periodImageNote: "Images enter by date; already encountered images are placed later in the sequence.", periodImageRandom: "Meet another image", periodImageOpen: "Open image source", periodImageCredit: "Source / note", periodImageEmpty: "Images are still waiting to be received; the articles from this day remain below.", periodImageSeen: "already encountered", periodEventsTitle: "Also happening on this day", periodEventsNote: "News, public calendars, astronomy and ecological signals sit beside one another; this is not a complete news digest.", periodEventEmpty: "Nothing has been received into this day’s event layer yet.", periodEventOpen: "Open source", eventOffer: "Offer an event from this day", eventOfferIntro: "Leave the date and source link; the other fields can stay empty. Once reviewed, it will enter this day.", eventLink: "Source link", eventDate: "Date of event", eventTitle: "Event title", eventExcerpt: "Short note", eventReason: "Why offer it?", eventSend: "Offer this day", eventSent: "Received. It is waiting for review.", vimeo: "Watch the film", vimeoOpen: "Open on Vimeo", mediaTitle: "Moving-image entrance", mediaIntro: "The film is another way of coming closer; the text archive remains here.", vimeoLabel: "Vimeo film", zhihuLabel: "Zhihu video fallback", mediaLoading: "The film is approaching…", mediaUnavailable: "The film could not be held just now.", mediaFallback: "Try the external entrance; if it remains unreachable, the text archive can continue.", mediaRetry: "Try again", mediaOpen: "Open external entrance",
  },
} as const;

function makePassport() { return crypto.randomUUID().replace(/-/g, ""); }
function formatId(id: number) { return String(id).padStart(3, "0"); }
function formatPeriodDate(value: string, locale: Locale) { const [, month, day] = value.split("-"); return locale === "zh" ? `${Number(month)}月${Number(day)}日` : `Mar ${Number(day)}`; }
function traceDisplayTitle(trace: Trace, locale: Locale, title?: string) {
  const value = (title ?? (locale === "en" ? trace.titleEn || trace.title : trace.title)).trim();
  const placeholder = value === "想法" || value.toLowerCase() === "idea" || !value;
  if (trace.type === "idea" && placeholder && trace.author) return locale === "en" ? `Idea · ${trace.author}` : `想法 · ${trace.author}`;
  return value;
}
function idOf(trace: Trace) { return trace.sourceId || String(trace.id); }
function legacyIdOf(trace: Trace) { return String(trace.id); }
function readableKey(kind: ReadableKind, id: string) { return `${kind}-${id}`; }
function isReadId(readSet: Set<string>, trace: Trace) {
  return readSet.has(idOf(trace)) || readSet.has(legacyIdOf(trace)) || readSet.has(readableKey("trace", idOf(trace))) || readSet.has(readableKey("trace", legacyIdOf(trace)));
}
function asTrace(item: CommunityTrace, index: number, sourceCount: number): Trace { return { id: sourceCount + index + 1, sourceId: item.id, schemaVersion: item.schemaVersion, type: item.type ?? "article", title: item.title, excerpt: item.excerpt, sourceLabel: "新的参考", sourceUrl: item.url, createdAt: item.publishedAt, topics: ["2026.03.16–22"] }; }
function typeLabel(type: TraceType, locale: Locale, text?: EditableCopy) { const key = `label${type[0].toUpperCase()}${type.slice(1)}`; return text?.[key] || activePageCopy?.[key] || (locale === "zh" ? TYPE_LABELS[type] : copy.en[key as "labelIdea" | "labelArticle" | "labelAnswer"]); }

function ReadToggleButton({ text, isRead, onMarkRead, className = "" }: { text: Record<string, string>; isRead: boolean; onMarkRead: () => void; className?: string }) {
  void text; void isRead; void onMarkRead; void className;
  return null;
}

async function deliverSubmission(path: string, body: SubmissionBody) {
  // Persist before the first network attempt. This makes a slow or offline
  // entrance a recoverable state instead of a lost contribution.
  const queued = await queueSubmission(path, body);
  try {
    const response = await archiveRequest(path, withSubmissionId(queued.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    if (response.ok || response.status === 409) {
      await removeQueuedSubmission(queued.id);
      return { response, queued: false, id: queued.id };
    }
    if (retryableResponse(response)) return { response, queued: true, id: queued.id };
    await removeQueuedSubmission(queued.id);
    return { response, queued: false, id: queued.id };
  } catch {
    return { response: undefined, queued: true, id: queued.id };
  }
}

function queueSubmissionRequest(record: QueuedSubmission) {
  return archiveRequest(record.path, withSubmissionId(record.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record.body) }));
}

export function defaultPageCopy(locale: Locale, total: number): Record<string, string> {
  const waiting = Math.max(0, 300 - total);
  const { heading: _heading, intro: _intro, ...labels } = copy[locale];
  const soundLabels = locale === "zh"
    ? { periodSoundTitle: "声音也在这里", periodSoundNote: "声音从原始页面进入；开放授权的声音可以直接播放或下载。", periodSoundOpen: "打开声音来源", periodSoundPlay: "播放声音", periodSoundContinue: "换日期时，声音仍留在水面上", periodSoundDownload: "下载声音", periodSoundLicense: "授权", periodSoundEmpty: "这一天暂时没有收进来的声音来源。", riverTitle: "名字沿着水面经过", riverHeading: "收录者的昵称，流过这一页", riverNote: "它在日期文章之后、随机遇见之前经过；这里流过档案中已有的作者与昵称。", timeObjectLabel: "时间不只向前", timeObjectNote: "让一周在不同的速度里同时发生。", hourglassLabel: "沙漏", clockLabel: "一刻钟", cinemaEnter: "进入影院", cinemaLeave: "离开影院", timeGestureDate: "日期被翻开了", timeGestureEncounter: "一条痕迹正在靠近", timeGestureRead: "它被你接住了", timeGestureSound: "声音把时间拉开", timeGestureOffer: "一份材料正在留下", timeGestureRestore: "足迹正在回来", timeGestureLanguage: "另一种语言靠近了", timeGestureExport: "公开资料被带走了", participantExportTitle: "参与者资料的公开副本", participantExportIntro: "任何人都可以带走一份当前已公开、已审核的参与资料；私人审核内容、阅读凭证、阅读进度和原始上传文件不会进入这里。", participantExportButton: "导出公开资料", participantExporting: "正在整理…", participantExported: "公开资料已经下载。", personalExportTitle: "我的足迹与见证", personalExportIntro: "下载这台设备上的阅读足迹，以及用这枚阅读凭证关联到的见证。不会包含别人的资料、阅读凭证本身或私密媒体原文件。", personalExportButton: "下载我的足迹与见证", personalExporting: "正在取回…", personalExported: "你的足迹与见证已经下载。", personalExportEmpty: "这里还没有找到你留下的见证。", materialsTitle: "项目材料", materialsIntro: "项目结构、变化与网站参考。", materialsArchitecture: "下载架构说明", materialsChangelog: "下载更新日志", materialsArtDirection: "下载网站美术参考", materialsSource: "下载源码包", materialsSourceNote: "" }
    : { periodSoundTitle: "Sound is here too", periodSoundNote: "Sound enters from its source; openly licensed pieces can be played or downloaded.", periodSoundOpen: "Open sound source", periodSoundPlay: "Play sound", periodSoundContinue: "When the date changes, the sound stays on the water", periodSoundDownload: "Download audio", periodSoundLicense: "Licence", periodSoundEmpty: "No sound source has been received into this day yet.", riverTitle: "Names passing over water", riverHeading: "The names of those collected, flowing through this page", riverNote: "It passes after the dated articles and before the random encounter; these are the archive’s existing authors and nicknames.", timeObjectLabel: "Time does not only move forward", timeObjectNote: "Let the week happen at several speeds at once.", hourglassLabel: "Hourglass", clockLabel: "A held hour", cinemaEnter: "Enter cinema", cinemaLeave: "Leave cinema", timeGestureDate: "The date has opened", timeGestureEncounter: "A trace is approaching", timeGestureRead: "It has been received", timeGestureSound: "Sound has opened time", timeGestureOffer: "A piece is being left", timeGestureRestore: "Your traces are returning", timeGestureLanguage: "Another language is arriving", timeGestureExport: "The public record has been carried away", participantExportTitle: "A public copy of participant materials", participantExportIntro: "Anyone may carry away the participation materials currently public and reviewed. Private review records, reading passes, reading progress and original uploads are not included.", participantExportButton: "Export public materials", participantExporting: "Gathering the materials…", participantExported: "The public materials have been downloaded.", personalExportTitle: "My traces and witnesses", personalExportIntro: "Download this device’s reading traces and the witnesses linked to this reading pass. It does not include anyone else’s records, the pass itself or private media files.", personalExportButton: "Download my traces and witnesses", personalExporting: "Recovering them…", personalExported: "Your traces and witnesses have been downloaded.", personalExportEmpty: "No witness has been linked to this pass yet.", materialsTitle: "Project materials", materialsIntro: "The project’s structure, changes and selected references for artist websites are kept here. The materials do not include the review key, reading passes, private review records or original uploads.", materialsArchitecture: "Download architecture", materialsChangelog: "Download changelog", materialsArtDirection: "Download art-direction references", materialsSource: "Download source package", materialsSourceNote: "The source package is a safe snapshot and can be downloaded directly by anyone; your review key is never included." };
  return {
    ...labels,
    ...soundLabels,
    personalExportIntro: locale === "zh" ? "下载你遇见过的文章、图片、事件、声音、影像与入口链接，以及用这枚阅读凭证关联到的见证。" : "Download the links to articles, images, events, sound, moving image and passages you encountered, together with witnesses linked to this reading pass.",
    mediaIntro: "",
    periodIntro: "",
    periodImageNote: locale === "zh" ? "按日期轮动。" : "A rotation by date.",
    periodEventsNote: locale === "zh" ? "新闻、日历、天文与生态信号。" : "News, calendars, astronomy and ecological signals.",
    periodSoundNote: locale === "zh" ? "从原始页面进入；开放授权的声音可播放或下载。" : "From the source page; openly licensed pieces may be played or downloaded.",
    periodSoundContinue: locale === "zh" ? "声音留在水面上。" : "Sound stays on the water.",
    riverNote: locale === "zh" ? "作者与昵称从这里经过。" : "Authors and names pass through here.",
    linksIntro: locale === "zh" ? "个人作品与社区创作。" : "Personal works and community creations.",
    linksWork: locale === "zh" ? "以斯帖的晨祷 · 个人作品" : "Esther's Morning Prayer · Personal works",
    linksCommunity: locale === "zh" ? "社区创作" : "Community creations",
    community: locale === "zh" ? "实时新增" : "Newly received",
    communityIntro: locale === "zh" ? "已经接住的内容，会在这里出现。" : "Received pieces appear here.",
    communityEmpty: locale === "zh" ? "还没有新的见证。" : "No new witness has arrived yet.",
    progressWitness: locale === "zh" ? "留言 / 见证" : "Messages / witnesses",
    progressScope: locale === "zh" ? "文章、图片、事件、声音、影像与入口，都在这里留下足迹。" : "Texts, images, events, sound, film and passages all leave a trace here.",
    materialsIntro: locale === "zh" ? "一份可直接复用的项目结构、数据格式与网站参考。" : "A reusable project structure, data format and selected website references.",
    materialsSourceNote: "",
    submitIntro: locale === "zh" ? "只需一个链接；其他信息可选。" : "Only the link is needed; the other details are optional.",
    participationIntro: "",
    participationReferenceNote: locale === "zh" ? "只需一个链接；日期、标题与说明都可以选填。" : "Only the link is required; the date, title and note are optional.",
    exportTitle: locale === "zh" ? "资料与足迹，带走一份" : "Materials and traces, carried away",
    exportIntro: "",
    participationTitle: locale === "zh" ? "提交见证" : "Submit a witness",
    participationReference: locale === "zh" ? "交来一条见证" : "Submit a witness",
    participationEvent: locale === "zh" ? "交来当天事件" : "Offer an event",
    participationEventNote: locale === "zh" ? "把某一天重新打开。" : "Open one day of the week again.",
    linksRelated: locale === "zh" ? "活动链接" : "Activity links",
    linksRelatedCommunity: locale === "zh" ? "相关整理" : "Related list",
    secondaryTitle: locale === "zh" ? "友情链接" : "Related links",
    secondaryIntro: "",
    secondaryOpen: locale === "zh" ? "打开友情链接" : "Open related links",
    secondaryClose: locale === "zh" ? "收起友情链接" : "Close related links",
    eyebrow: locale === "zh" ? "一份可被遇见的阅读档案" : "An archive made to be encountered",
    headingLead: locale === "zh" ? "慢一点，" : "Slow down. ",
    headingEmphasis: locale === "zh" ? "遇见" : "Meet",
    headingTail: locale === "zh" ? "一条痕迹。" : " a trace.",
    intro: locale === "zh" ? (waiting ? `这里已有 ${total} 个被留下的片段；还有 ${waiting} 个位置，仍在等待被接住。你可以随机遇见，也可以沿着某一种形式靠近它们。` : `这里有 ${total} 个被留下的片段。你可以随机遇见，也可以沿着某一种形式靠近它们。`) : (waiting ? `${total} fragments have been left here; ${waiting} places are still waiting to be received. Encounter one at random, or move closer through a chosen form.` : `There are ${total} fragments left here. Encounter one at random, or move closer through a chosen form.`),
    footerLeft: locale === "zh" ? "300条痕迹" : "300 traces",
    footerRight: locale === "zh" ? "阅读是一种接住。" : "Reading is a way of receiving.",
    countryTitle: locale === "zh" ? "原住民致意" : "Acknowledgement of Country",
    countryText: locale === "zh" ? "此网站建构于 Gadigal Country。我们向澳大利亚各地的 Traditional Owners 致意，尊重他们与 Country 的持续联系，并向过去、现在与正在成为长者的人表示敬意。" : "This website is built on Gadigal Country. We acknowledge the Traditional Owners of Country throughout Australia, their continuing connection to Country, and Elders past, present and emerging.",
    countryLinkText: locale === "zh" ? "官方参考" : "Official reference",
    countryFlagAlt: locale === "zh" ? "澳大利亚原住民旗帜与托雷斯海峡岛民旗帜的色彩标记" : "Australian Aboriginal and Torres Strait Islander Flag colours",
    countryLocalTitle: locale === "zh" ? "此项目 · Gadigal / Eora Nation" : "This project · Gadigal / Eora Nation",
    countryLocalText: locale === "zh" ? "当前版本在悉尼的 Gadigal Country 上发展。" : "This version is being developed on Gadigal Country in Sydney.",
    countryOtherTitle: locale === "zh" ? "当地语境" : "Local context",
    countryOtherText: locale === "zh" ? "请按阅读发生地，了解当地的 Traditional Owners 与 Country。" : "Learn the Traditional Owners and Country where the archive is being read.",
    countryWiderTitle: locale === "zh" ? "更广的致意 · Aboriginal and Torres Strait Islander peoples" : "Wider acknowledgement · Aboriginal and Torres Strait Islander peoples",
    countryWiderText: locale === "zh" ? "向所有 Aboriginal and Torres Strait Islander peoples 与长者致意。" : "Respect to Aboriginal and Torres Strait Islander peoples and Elders.",
    passportPromptTitle: locale === "zh" ? "先留下一枚凭证。" : "Keep a small pass.",
    passportPromptAcknowledge: locale === "zh" ? "我已经记下了" : "I have kept it",
    receivedTitle: locale === "zh" ? "已经被接住。" : "It has been received.",
    submissionPassTitle: locale === "zh" ? "你的记录存档码已与这条见证绑定。" : "Your record archive code is now linked to this witness.",
    submissionPassNote: locale === "zh" ? "请复制并妥善保存它；以后可在“友情链接 → 我的足迹与见证”导出自己的记录，或在新设备上取回足迹。" : "Copy and keep it. Later, use “Related links → My traces and witnesses” to export your own record, or recover your traces on another device.",
    submissionPassExport: locale === "zh" ? "现在导出我的足迹与见证" : "Export my traces and witnesses now",
    adminEntry: locale === "zh" ? "编辑 / 审核" : "Edit / review",
    dialogClose: locale === "zh" ? "关闭" : "Close",
  } as Record<string, string>;
}

function SurrealClockField() {
  const field = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const seconds = (now - started) / 1000;
      const target = field.current;
      if (target) {
        const secondAngle = seconds * 31 + Math.sin(seconds * 0.64) * 70 + Math.sin(seconds * 0.13) * 40;
        const hourAngle = seconds * 2.6 + Math.sin(seconds * 0.17) * 32 + Math.sin(seconds * 0.041) * 18;
        target.style.setProperty("--clock-second-angle", `${secondAngle}deg`);
        target.style.setProperty("--clock-hour-angle", `${hourAngle}deg`);
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className="surreal-clock-field" ref={field} aria-hidden="true"><span className="surreal-clock-orbit surreal-clock-orbit-one" /><span className="surreal-clock-orbit surreal-clock-orbit-two" /><div className="surreal-clock-face"><span className="surreal-clock-numeral surreal-clock-numeral-12">12</span><span className="surreal-clock-numeral surreal-clock-numeral-3">3</span><span className="surreal-clock-numeral surreal-clock-numeral-6">6</span><span className="surreal-clock-numeral surreal-clock-numeral-9">9</span><i className="surreal-clock-hand surreal-clock-hour-hand" /><i className="surreal-clock-hand surreal-clock-second-hand" /><i className="surreal-clock-pivot" /></div></div>;
}

function StartupClock({ caption, phase }: { caption: string; phase: Exclude<StartupPhase, "done"> }) {
  const clock = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const animate = (now: number) => {
      const seconds = (now - started) / 1000;
      const target = clock.current;
      if (target) {
        const secondAngle = seconds * 18 + Math.sin(seconds * 0.28) * 7 + Math.sin(seconds * 0.07) * 3;
        const minuteAngle = seconds * 3.2 + Math.sin(seconds * 0.16) * 5;
        const hourAngle = seconds * 0.8 + Math.sin(seconds * 0.08) * 4;
        target.style.setProperty("--startup-second-angle", `${secondAngle}deg`);
        target.style.setProperty("--startup-minute-angle", `${minuteAngle}deg`);
        target.style.setProperty("--startup-hour-angle", `${hourAngle}deg`);
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return <div className={`startup-screen ${phase === "leaving" ? "is-leaving" : ""}`} role="status" aria-live="polite"><div className="startup-gradient" aria-hidden="true" /><div className="startup-center"><div className="startup-clock" ref={clock}><span className="startup-clock-ring startup-clock-ring-one" /><span className="startup-clock-ring startup-clock-ring-two" /><span className="startup-clock-number startup-clock-number-12">12</span><span className="startup-clock-number startup-clock-number-3">3</span><span className="startup-clock-number startup-clock-number-6">6</span><span className="startup-clock-number startup-clock-number-9">9</span><i className="startup-clock-hand startup-clock-hour" /><i className="startup-clock-hand startup-clock-minute" /><i className="startup-clock-hand startup-clock-second" /><i className="startup-clock-pivot" /></div><p className="startup-caption">{caption}</p></div></div>;
}

function RiverLayer({ text, authors }: { text: Record<string, string>; authors: string[] }) {
  return <section className="trace-river" aria-labelledby="trace-river-heading"><div className="section-heading"><div><p className="eyebrow">{text.riverTitle}</p><h2 id="trace-river-heading">{text.riverHeading}</h2></div><span className="period-intro">{text.riverNote}</span></div>{authors.length ? <div className="river-stage"><div className="river-glint" aria-hidden="true" /><div className="river-name-track"><div className="river-name-set" role="list" aria-label={text.riverHeading}>{authors.map((author, index) => <span className="river-name" role="listitem" key={`${author}-${index}`}>{author}</span>)}</div><div className="river-name-set" aria-hidden="true">{authors.map((author, index) => <span className="river-name" key={`echo-${author}-${index}`}>{author}</span>)}</div></div></div> : <p className="period-empty">{text.riverNote}</p>}</section>;
}

function MediaEntrance({ text, vimeoUrl, zhihuVideoUrl, bilibiliVideoUrl, cinemaMode, onCinemaModeChange, isRead, onMarkRead }: { text: Record<string, string>; vimeoUrl: string; zhihuVideoUrl: string; bilibiliVideoUrl: string; cinemaMode: boolean; onCinemaModeChange: (next: boolean) => void; isRead: boolean; onMarkRead: () => void }) {
  const [vimeoState, setVimeoState] = useState<"loading" | "ready" | "failed">(vimeoUrl ? "loading" : "failed");
  const [reloadToken, setReloadToken] = useState(0);
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const embed = vimeoEmbedUrl(vimeoUrl);
  useEffect(() => {
    const receiveVimeoMessage = (event: MessageEvent) => {
      if (event.origin !== "https://player.vimeo.com" || typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as { event?: string };
        if (message.event === "play") { onMarkRead(); onCinemaModeChange(true); }
        if (message.event === "pause" || message.event === "finish") onCinemaModeChange(false);
      } catch { /* unrelated postMessage payload */ }
    };
    window.addEventListener("message", receiveVimeoMessage);
    return () => window.removeEventListener("message", receiveVimeoMessage);
  }, [onCinemaModeChange, onMarkRead]);
  function sendVimeoMessage(method: string) { iframe.current?.contentWindow?.postMessage(JSON.stringify({ method }), "https://player.vimeo.com"); }
  function enterCinema() {
    onMarkRead();
    onCinemaModeChange(true);
    sendVimeoMessage("play");
  }
  function leaveCinema() {
    onCinemaModeChange(false);
  }
  if (!vimeoUrl && !zhihuVideoUrl && !bilibiliVideoUrl) return null;
  return <section className={`media-entrance ${cinemaMode ? "is-cinema" : ""}`} aria-labelledby="media-entrance-heading">
    <div className="section-heading"><div><p className="eyebrow">{text.mediaTitle}</p><h2 id="media-entrance-heading">{text.mediaTitle}</h2></div><span className="period-intro">{text.mediaIntro}</span></div>
    <div className="media-grid">
      {vimeoUrl && embed && <figure className={`vimeo-preview media-frame-${vimeoState}`}>
        <div className="media-frame"><iframe ref={iframe} key={reloadToken} src={embed} title={text.vimeoLabel} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen onLoad={(event) => { setVimeoState("ready"); for (const value of ["play", "pause", "finish"]) event.currentTarget.contentWindow?.postMessage(JSON.stringify({ method: "addEventListener", value }), "https://player.vimeo.com"); }} onError={() => setVimeoState("failed")} />
          {vimeoState === "loading" && <div className="media-status" role="status">{text.mediaLoading}</div>}
          {vimeoState === "failed" && <div className="media-failure" role="status"><strong>{text.mediaUnavailable}</strong><span>{text.mediaFallback}</span><div><a href={vimeoUrl} target="_blank" rel="noreferrer" onClick={onMarkRead}>{text.mediaOpen} ↗</a><button type="button" onClick={() => { setReloadToken((value) => value + 1); setVimeoState("loading"); }}>{text.mediaRetry}</button></div></div>}
        </div>
        <figcaption><span>{text.vimeoLabel}</span><div className="cinema-actions"><button type="button" onClick={cinemaMode ? leaveCinema : enterCinema}>{cinemaMode ? text.cinemaLeave : text.cinemaEnter}</button><a href={vimeoUrl} target="_blank" rel="noreferrer" onClick={onMarkRead}>{text.mediaOpen} ↗</a><ReadToggleButton text={text} isRead={isRead} onMarkRead={onMarkRead} /></div></figcaption>
      </figure>}
      {zhihuVideoUrl && <article className="media-source-card"><a className="media-source-main" href={zhihuVideoUrl} target="_blank" rel="noreferrer" onClick={onMarkRead}><span>知乎 · Zhihu</span><strong>{text.zhihuLabel}</strong><small>{text.mediaFallback}</small><b>{text.mediaOpen} ↗</b></a>{!vimeoUrl && <ReadToggleButton text={text} isRead={isRead} onMarkRead={onMarkRead} />}</article>}
      {bilibiliVideoUrl && <article className="media-source-card"><a className="media-source-main" href={bilibiliVideoUrl} target="_blank" rel="noreferrer" onClick={onMarkRead}><span>Bilibili · 哔哩哔哩</span><strong>{text.bilibiliLabel || "Bilibili video"}</strong><small>{text.mediaFallback}</small><b>{text.mediaOpen} ↗</b></a>{!vimeoUrl && !zhihuVideoUrl && <ReadToggleButton text={text} isRead={isRead} onMarkRead={onMarkRead} />}</article>}
    </div>
  </section>;
}

function RelatedLinksSection({ text, locale, links, order, readSet, onMarkRead }: { text: Record<string, string>; locale: Locale; links: RelatedLink[]; order: number; readSet: Set<string>; onMarkRead: (id: string) => void }) {
  const buildGroups = (kind: RelatedLink["kind"]) => {
    const grouped = links.filter((link) => link.kind === kind).reduce((map, link) => {
      const key = link.activityId || `single-${link.id}`;
      const group = map.get(key) || [];
      group.push(link);
      map.set(key, group);
      return map;
    }, new Map<string, RelatedLink[]>());
    return Array.from(grouped, ([key, group]) => {
      const primary = group.find((link) => link.activityRole === "activity") || group[0];
      return { key, primary, children: group.filter((link) => link.id !== primary.id) };
    });
  };
  const workGroups = buildGroups("work");
  const communityGroups = buildGroups("community");
  const titleFor = (link: RelatedLink) => locale === "en" ? link.titleEn || link.titleZh : link.titleZh || link.titleEn;
  const noteFor = (link: RelatedLink) => locale === "en" ? link.noteEn || link.noteZh : link.noteZh || link.noteEn;
  const channelFor = (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (host.endsWith("zhihu.com")) return "知乎";
      if (host === "notion.so" || host.endsWith("notion.site")) return "Notion";
      if (host === "sooon.ai") return "sooon.ai";
      if (host === "apps.apple.com") return "App Store";
      return host;
    } catch {
      return locale === "zh" ? "链接" : "Link";
    }
  };
  const renderLink = (link: RelatedLink) => {
    const note = noteFor(link);
    return <article className="related-link" key={link.id}>
      <div className="related-link-content">
        <span className="related-link-kind">{channelFor(link.url)}</span>
        <a className="related-link-title" href={link.url} target="_blank" rel="noreferrer" onClick={() => onMarkRead(link.id)}><strong>{titleFor(link)}</strong></a>
        {note && <small>{note}</small>}
      </div>
      <div className="related-link-actions">
        <a className="related-link-open" href={link.url} target="_blank" rel="noreferrer" onClick={() => onMarkRead(link.id)}>{text.linksOpen} ↗</a>
        <ReadToggleButton text={text} isRead={readSet.has(readableKey("link", link.id))} onMarkRead={() => onMarkRead(link.id)} />
      </div>
    </article>;
  };
  const renderGroup = ({ key, primary, children }: { key: string; primary: RelatedLink; children: RelatedLink[] }) => <article className="related-activity" key={key}>
    <div className="related-activity-heading">
      <div className="related-activity-heading-copy"><strong>{titleFor(primary)}</strong></div>
      <div className="related-activity-actions">
        <a className="related-activity-open" href={primary.url} target="_blank" rel="noreferrer" onClick={() => onMarkRead(primary.id)}>{text.linksOpen} ↗</a>
        <ReadToggleButton text={text} isRead={readSet.has(readableKey("link", primary.id))} onMarkRead={() => onMarkRead(primary.id)} />
      </div>
    </div>
    {children.length > 0 && <div className="related-activity-links">{children.map(renderLink)}</div>}
  </article>;
  const renderCategory = (kind: RelatedLink["kind"], title: string, groups: ReturnType<typeof buildGroups>) => <div className={`related-links-category related-links-${kind}`}>
    <p className="period-fragment-meta">{title}</p>
    {groups.length ? groups.map(renderGroup) : <p className="period-empty">{text.linksEmpty}</p>}
  </div>;
  return <section className="related-links-section" data-content-section="links" style={{ order }} aria-labelledby="related-links-heading"><div className="section-heading"><div><p className="eyebrow">{text.linksTitle}</p><h2 id="related-links-heading">{text.linksTitle}</h2></div><span className="period-intro">{text.linksIntro}</span></div>{links.length ? <div className="related-links-groups">{renderCategory("work", text.linksWork, workGroups)}{renderCategory("community", text.linksCommunity, communityGroups)}</div> : <p className="period-empty">{text.linksEmpty}</p>}</section>;
}

declare global { interface Window { Translator?: { availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>; create: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<{ translate: (text: string) => Promise<string> }> }; } }

export function TraceArchive() {
  const sourceTraces = initialTraceData;
  // Keep the server render deterministic. Browser storage is restored after
  // hydration so a returning reader cannot create a React hydration mismatch.
  const [readIds, setReadIds] = useState<string[]>([]);
  const [periodImageReadIds, setPeriodImageReadIds] = useState<string[]>([]);
  const [periodImageId, setPeriodImageId] = useState<string | null>(null);
  const [periodArticleReadIds, setPeriodArticleReadIds] = useState<string[]>([]);
  const [periodArticleIds, setPeriodArticleIds] = useState<string[]>([]);
  const [passport, setPassport] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [periodDate, setPeriodDate] = useState<string>(INITIAL_PERIOD_DATE);
  const [community, setCommunity] = useState<CommunityTrace[]>(() => Array.isArray(publicSnapshot.traces) ? publicSnapshot.traces as CommunityTrace[] : []);
  const [communityEvents, setCommunityEvents] = useState<CommunityEvent[]>([]);
  const [communityGuestbook, setCommunityGuestbook] = useState<CommunityGuestbook[]>(() => Array.isArray(publicSnapshot.guestbook) ? publicSnapshot.guestbook as CommunityGuestbook[] : []);
  const [currentId, setCurrentId] = useState("1");
  const [locale, setLocale] = useState<Locale>("en");
  const [cinemaMode, setCinemaMode] = useState(false);
  const [translation, setTranslation] = useState<{ title: string; excerpt: string } | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showWitnessForm, setShowWitnessForm] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [showSecondary, setShowSecondary] = useState(false);
  const [showPassport, setShowPassport] = useState(false);
  const [passportPrompt, setPassportPrompt] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState(false);
  const [restoreValue, setRestoreValue] = useState("");
  const [notice, setNotice] = useState("");
  const [referenceReceived, setReferenceReceived] = useState(false);
  const [personalExporting, setPersonalExporting] = useState(false);
  const [personalExported, setPersonalExported] = useState(false);
  const [atmosphere, setAtmosphere] = useState<{ image: string | null; audio: string | null }>({ image: null, audio: null });
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => publicSnapshot.settings as SiteSettings || {});
  const [localStorageHydrated, setLocalStorageHydrated] = useState(false);
  const [startupPhase, setStartupPhase] = useState<StartupPhase>("show");
  const audio = useRef<HTMLAudioElement | null>(null);
  const periodSoundElement = useRef<HTMLAudioElement | null>(null);
  const [periodSoundId, setPeriodSoundId] = useState<string | null>(null);
  const [periodSoundPlaying, setPeriodSoundPlaying] = useState(false);
  const [periodSoundError, setPeriodSoundError] = useState("");
  const [timeGesture, setTimeGesture] = useState<TimeEcho | null>(null);
  const syncTimer = useRef<number | null>(null);
  const communityTag = useRef("");
  const loaded = useRef(false);
  const timeGestureTimer = useRef<number | null>(null);
  const showOffer = showWitnessForm;
  useEffect(() => {
    setReadIds(localStringArray(READ_KEY));
    setPeriodImageReadIds(localStringArray(PERIOD_IMAGE_READ_KEY));
    setPeriodArticleReadIds(localStringArray(PERIOD_ARTICLE_READ_KEY));
    setLocale(localRead(LOCALE_KEY) === "zh" ? "zh" : "en");
    setLocalStorageHydrated(true);
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveTimer = window.setTimeout(() => setStartupPhase("leaving"), reduced ? 420 : 1600);
    const finishTimer = window.setTimeout(() => setStartupPhase("done"), reduced ? 720 : 2600);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(finishTimer); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("is-cinema", cinemaMode);
    return () => document.documentElement.classList.remove("is-cinema");
  }, [cinemaMode]);
  const triggerTimeGesture = useCallback((gesture: TimeGesture) => {
    const motifs = ["sand", "candle", "both"] as const;
    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    const tilt = Math.round((Math.random() * 8 - 4) * 10) / 10;
    setTimeGesture({ gesture, motif, seed: Date.now() + Math.random(), tilt });
    if (timeGestureTimer.current) window.clearTimeout(timeGestureTimer.current);
    timeGestureTimer.current = window.setTimeout(() => setTimeGesture(null), 2800);
  }, []);
  useEffect(() => () => { if (timeGestureTimer.current) window.clearTimeout(timeGestureTimer.current); }, []);
  const allTraces = useMemo(() => [...sourceTraces, ...community.map((item, index) => asTrace(item, index, sourceTraces.length))], [community, sourceTraces]);
  const periodEntries = useMemo(() => PERIOD_DATES.map((date) => ({ date, traces: allTraces.filter((trace) => trace.createdAt?.slice(0, 10) === date) })), [allTraces]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const currentTrace = allTraces.find((trace) => idOf(trace) === currentId) ?? allTraces[0];
  const selectedPeriod = periodEntries.find((entry) => entry.date === periodDate) ?? periodEntries[0];
  const previousPeriodDate = useRef(periodDate);
  useEffect(() => {
    if (previousPeriodDate.current === periodDate) return;
    previousPeriodDate.current = periodDate;
    triggerTimeGesture("date");
  }, [periodDate, triggerTimeGesture]);
  const periodImageReadSet = useMemo(() => new Set(periodImageReadIds), [periodImageReadIds]);
  const firstPeriodImageDate = PERIOD_IMAGES.find((image) => image.status === "approved")?.date;
  const periodImagePool = useMemo(() => PERIOD_IMAGES.filter((image) => image.status === "approved" && image.date === selectedPeriod.date), [selectedPeriod.date]);
  const periodAudioEntries = useMemo(() => PERIOD_AUDIO.filter((audioEntry) => audioEntry.status === "approved" && audioEntry.date === selectedPeriod.date), [selectedPeriod.date]);
  const periodSoundEntry = PERIOD_AUDIO.find((audioEntry) => audioEntry.id === periodSoundId && audioEntry.status === "approved");
  const riverAuthors = useMemo(() => [...new Set(allTraces.map((trace) => trace.author?.trim()).filter((author): author is string => Boolean(author) && author !== "undefined" && author !== "null"))], [allTraces]);
  const communityEventEntries = useMemo(() => communityEvents.map((event) => ({ id: event.id, date: event.date, category: "community" as const, titleZh: event.title, titleEn: event.title, excerptZh: event.excerpt, excerptEn: event.excerpt, sourceLabel: event.sourceLabel || "参与者投稿", sourceUrl: event.url, status: "confirmed" as const })), [communityEvents]);
  const publicEventEntries = useMemo(() => {
    const entries = new Map(PERIOD_EVENTS.map((event) => [event.id, event]));
    communityEventEntries.forEach((event) => entries.set(event.id, event));
    return [...entries.values()];
  }, [communityEventEntries]);
  const periodEventEntries = useMemo(() => publicEventEntries.filter((event) => event.date === selectedPeriod.date), [publicEventEntries, selectedPeriod.date]);
  const drawPeriodImage = useCallback(() => {
    const unread = periodImagePool.filter((image) => !periodImageReadSet.has(image.id));
    const available = (unread.length ? unread : periodImagePool).filter((image) => image.id !== periodImageId);
    const choices = available.length ? available : periodImagePool;
    setPeriodImageId(choices[Math.floor(Math.random() * choices.length)]?.id ?? null);
  }, [periodImagePool, periodImageReadSet, periodImageId]);
  useEffect(() => {
    if (!periodImagePool.length) return setPeriodImageId(null);
    if (!periodImagePool.some((image) => image.id === periodImageId)) drawPeriodImage();
  }, [drawPeriodImage, periodImageId, periodImagePool]);
  useEffect(() => {
    if (!periodImageId) return;
    setPeriodImageReadIds((ids) => ids.includes(periodImageId) ? ids : [...ids, periodImageId]);
  }, [periodImageId]);
  const currentPeriodImage = periodImagePool.find((image) => image.id === periodImageId);
  useEffect(() => {
    if (!currentPeriodImage?.imageUrl) return;
    const image = new Image();
    image.src = currentPeriodImage.imageUrl;
  }, [currentPeriodImage?.imageUrl]);
  const periodArticleReadSet = useMemo(() => new Set(periodArticleReadIds), [periodArticleReadIds]);
  const periodArticlePool = useMemo(() => selectedPeriod.traces, [selectedPeriod.traces]);
  const drawPeriodArticles = useCallback(() => {
    const unread = periodArticlePool.filter((trace) => !periodArticleReadSet.has(idOf(trace)));
    const preferred = (unread.length ? unread : periodArticlePool).filter((trace) => !periodArticleIds.includes(idOf(trace)));
    const source = preferred.length ? preferred : (unread.length ? unread : periodArticlePool);
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const next = shuffled.slice(0, Math.min(3, shuffled.length));
    if (next.length < Math.min(3, periodArticlePool.length)) {
      const fillers = periodArticlePool.filter((trace) => !next.some((item) => idOf(item) === idOf(trace)));
      next.push(...fillers.slice(0, Math.min(3, periodArticlePool.length) - next.length));
    }
    setPeriodArticleIds(next.map(idOf));
  }, [periodArticleIds, periodArticlePool, periodArticleReadSet]);
  useEffect(() => {
    if (!periodArticlePool.length) return setPeriodArticleIds([]);
    const valid = periodArticleIds.length > 0 && periodArticleIds.every((id) => periodArticlePool.some((trace) => idOf(trace) === id));
    if (!valid) drawPeriodArticles();
  }, [drawPeriodArticles, periodArticleIds, periodArticlePool]);
  useEffect(() => {
    if (!periodArticleIds.length) return;
    setPeriodArticleReadIds((ids) => [...new Set([...ids, ...periodArticleIds])]);
  }, [periodArticleIds]);
  const currentPeriodArticles = periodArticleIds.length
    ? periodArticleIds.map((id) => periodArticlePool.find((trace) => idOf(trace) === id)).filter((trace): trace is Trace => Boolean(trace))
    : periodArticlePool.slice(0, 3);

  useEffect(() => {
    let live = true;
    const refreshCommunity = async () => {
      const result = await readCommunity(communityTag.current || undefined);
      if (!live || result.notModified || !result.payload) return;
      if (result.etag) communityTag.current = result.etag;
      const traces = new Map<string, CommunityTrace>();
      const events = new Map<string, CommunityEvent>();
      const guestbook = new Map<string, CommunityGuestbook>();
      for (const item of Array.isArray(result.payload.traces) ? result.payload.traces : []) if (item?.url) traces.set(item.url, item);
      for (const item of Array.isArray(result.payload.events) ? result.payload.events : []) if (item?.id && item?.url && item?.date) events.set(item.id, item);
      for (const item of Array.isArray(result.payload.guestbook) ? result.payload.guestbook : []) if (item?.id && item?.message) guestbook.set(item.id, item);
      setCommunity([...traces.values()]);
      setCommunityEvents([...events.values()]);
      setCommunityGuestbook([...guestbook.values()]);
    };
    void refreshCommunity().catch(() => undefined);
    // Newly approved material may arrive with a short delay; the archive does
    // not need a chat-like poll. This keeps the public reader quiet by default.
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refreshCommunity().catch(() => undefined); }, 120000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const player = periodSoundElement.current;
    if (!player) return;
    const handlePlay = () => { setPeriodSoundPlaying(true); setPeriodSoundError(""); setNotice(""); };
    const handlePause = () => setPeriodSoundPlaying(false);
    const handleEnded = () => setPeriodSoundPlaying(false);
    const handleError = () => { const message = locale === "zh" ? "声音暂时无法加载，可以打开声音来源或稍后再试。" : "The sound could not load. Open its source or try again later."; setPeriodSoundPlaying(false); setPeriodSoundError(message); setNotice(message); };
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);
    player.addEventListener("error", handleError);
    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
      player.removeEventListener("error", handleError);
    };
  }, [locale]);

  useEffect(() => {
    const retry = () => { void flushQueuedSubmissions(queueSubmissionRequest).catch(() => undefined); };
    retry();
    window.addEventListener("online", retry);
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") retry(); }, 45000);
    return () => { window.removeEventListener("online", retry); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const savedPassport = localRead(PASSPORT_KEY) || makePassport();
    localWrite(PASSPORT_KEY, savedPassport);
    if (!passport) setPassport(savedPassport);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    let live = true;
    const savedPassport = passport || localRead(PASSPORT_KEY) || makePassport();
    if (!passport) {
      localWrite(PASSPORT_KEY, savedPassport);
      setPassport(savedPassport);
    }
    void Promise.all([
      archiveRequestWithEndpoint("/api/atmosphere").then(({ response, endpoint }) => response.ok ? response.json().then((data) => data && live && setAtmosphere({ image: data.image ? resolveMediaPath(data.image, endpoint) : null, audio: data.audio ? resolveMediaPath(data.audio, endpoint) : null })) : undefined).catch(() => undefined),
      archiveRequest("/api/site-settings").then((response) => response.ok ? response.json() : undefined).then((data) => { if (live && data) setSiteSettings((current) => ({ ...current, ...data, zh: { ...current.zh, ...data.zh }, en: { ...current.en, ...data.en } })); }).catch(() => undefined),
      archiveRequest("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: savedPassport, action: "read" }) }).then((response) => response.ok ? response.json() : undefined).then((data) => { if (live && Array.isArray(data?.ids) && data.ids.length) setReadIds((local) => [...new Set([...local, ...data.ids])]); }).catch(() => undefined),
    ]).finally(() => {
      if (!live) return;
      loaded.current = true;
    });
    return () => { live = false; };
  }, []);

  useEffect(() => { if (localStorageHydrated) localWrite(LOCALE_KEY, locale); }, [localStorageHydrated, locale]);
  useEffect(() => { if (showOffer) setShowPassport(false); }, [showOffer]);
  useEffect(() => { if (!showQr) return; setQrDataUrl(""); setQrError(false); const currentUrl = new URL(window.location.href); currentUrl.search = ""; currentUrl.hash = ""; const target = PUBLIC_ARCHIVE_URL || currentUrl.toString(); void QRCode.toDataURL(target, { errorCorrectionLevel: "M", margin: 2, width: 720, color: { dark: "#262321", light: "#f8f5ef" } }).then(setQrDataUrl).catch(() => setQrError(true)); }, [showQr]);
  useLayoutEffect(() => { if (showOffer) document.querySelector<HTMLFormElement>(".reference-form")?.setAttribute("novalidate", ""); }, [showOffer]);
  useEffect(() => { if (localStorageHydrated) localWrite(READ_KEY, JSON.stringify(readIds)); }, [localStorageHydrated, readIds]);
  useEffect(() => { if (localStorageHydrated) localWrite(PERIOD_IMAGE_READ_KEY, JSON.stringify(periodImageReadIds)); }, [localStorageHydrated, periodImageReadIds]);
  useEffect(() => { if (localStorageHydrated) localWrite(PERIOD_ARTICLE_READ_KEY, JSON.stringify(periodArticleReadIds)); }, [localStorageHydrated, periodArticleReadIds]);
  useEffect(() => {
    if (!loaded.current || !passport) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      void archiveRequest("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: passport, ids: readIds }) }).catch(() => undefined);
    }, 1200);
    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); };
  }, [passport, readIds]);

  useEffect(() => {
    setTranslation(null);
    if (locale !== "en" || !currentTrace || currentTrace.titleEn || !window.Translator) return;
    let live = true;
    setIsTranslating(true);
    void (async () => {
      try {
        const options = { sourceLanguage: "zh", targetLanguage: "en" };
        const availability = await window.Translator?.availability(options);
        if (availability !== "available" && availability !== "downloadable") return;
        const translator = await window.Translator?.create(options);
        if (!translator || !live) return;
        const [title, excerpt] = await Promise.all([translator.translate(currentTrace.title), translator.translate(currentTrace.excerpt)]);
        if (live) setTranslation({ title, excerpt });
      } catch { /* original wording stays visible */ } finally { if (live) setIsTranslating(false); }
    })();
    return () => { live = false; };
  }, [currentTrace, locale]);

  const candidatesFor = useCallback((nextFilter: Filter, preferUnread = true) => {
    const filtered = allTraces.filter((trace) => nextFilter === "all" || trace.type === nextFilter);
    const unread = filtered.filter((trace) => !isReadId(readSet, trace));
    const preferred = preferUnread && unread.length ? unread : filtered;
    const withoutCurrent = preferred.filter((trace) => idOf(trace) !== currentId);
    return withoutCurrent.length ? withoutCurrent : preferred;
  }, [allTraces, currentId, readSet]);
  const draw = useCallback((nextFilter = filter) => { const candidates = candidatesFor(nextFilter); if (candidates.length) { setCurrentId(idOf(candidates[Math.floor(Math.random() * candidates.length)])); triggerTimeGesture("encounter"); } }, [candidatesFor, filter, triggerTimeGesture]);
  const chooseFilter = (value: Filter) => { setFilter(value); draw(value); };
  const markTraceRead = (trace: Trace) => {
    if (isReadId(readSet, trace)) return;
    triggerTimeGesture("read");
    setReadIds((ids) => {
      const key = readableKey("trace", idOf(trace));
      return ids.includes(key) ? ids : [...ids, key];
    });
  };
  const markContentRead = (kind: Exclude<ReadableKind, "trace">, id: string) => {
    const key = readableKey(kind, id);
    if (readSet.has(key)) return;
    triggerTimeGesture("read");
    setReadIds((ids) => ids.includes(key) ? ids : [...ids, key]);
  };
  if (!sourceTraces.length) return <main className="archive-shell"><p className="eyebrow">300 traces</p><p className="archive-note">正在靠近档案…</p></main>;

  const vimeoUrl = safeVimeoUrl(siteSettings.vimeoUrl);
  const zhihuVideoUrl = safeZhihuVideoUrl(siteSettings.zhihuVideoUrl);
  const bilibiliVideoUrl = safeBilibiliVideoUrl(siteSettings.bilibiliVideoUrl);
  const relatedLinks = normalizeRelatedLinks(siteSettings.relatedLinks).map((link) => {
    if (link.id === "sooon-official") return { ...link, activityId: "sooon-ai", activityRole: "activity" as const };
    if (link.id === "sooon-introduction" || link.id === "sooon-exploration-guide") return { ...link, activityId: "sooon-ai", activityRole: "related" as const };
    return link;
  }).filter((link) => link.enabled !== false);
  const approvedImages = PERIOD_IMAGES.filter((image) => image.status === "approved");
  const approvedAudio = PERIOD_AUDIO.filter((entry) => entry.status === "approved");
  const archiveTotal = allTraces.length;
  const total = archiveTotal + approvedImages.length + publicEventEntries.length + approvedAudio.length + relatedLinks.length + (vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl ? 1 : 0);
  const auxiliaryReadCount = (kind: Exclude<ReadableKind, "trace">, ids: string[]) => ids.filter((id) => readSet.has(readableKey(kind, id))).length;
  const totalRead = allTraces.filter((trace) => isReadId(readSet, trace)).length
    + auxiliaryReadCount("image", approvedImages.map((image) => image.id))
    + auxiliaryReadCount("event", publicEventEntries.map((event) => event.id))
    + auxiliaryReadCount("audio", approvedAudio.map((entry) => entry.id))
    + auxiliaryReadCount("link", relatedLinks.map((link) => link.id))
    + (vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl ? (readSet.has(readableKey("film", "main")) ? 1 : 0) : 0);
  const defaultText = defaultPageCopy(locale, archiveTotal);
  const t: Record<string, string> = Object.fromEntries(Object.entries({ ...defaultText, ...siteSettings[locale] }).map(([key, value]) => [key, typeof value === "string" ? value : ""]));
  if (!t.bilibiliLabel) t.bilibiliLabel = locale === "zh" ? "Bilibili 视频入口" : "Bilibili video";
  const includesAny = (value: string | undefined, ...parts: string[]) => Boolean(value && parts.some((part) => value.includes(part)));
  if (t.materialsSource === "下载源码包" || t.materialsSource === "Download source package") t.materialsSource = locale === "zh" ? "下载复刻包" : "Download replication kit";
  if (includesAny(t.exportIntro, "同一个出口", "share one quiet exit", "your own device")) t.exportIntro = "";
  if (includesAny(t.submitIntro, "留下一条链接", "自动整理", "私密审核处", "private place", "private review", "organized automatically", "random encounter")) t.submitIntro = locale === "zh" ? "只需一个链接；其他信息可选。" : "Only the link is needed; the other details are optional.";
  if (includesAny(t.linksIntro, "彼此留下入口", "leave their entrances here")) t.linksIntro = locale === "zh" ? "以前的作品与社区创作。" : "Earlier works and community-made projects.";
  if (includesAny(t.periodIntro, "图片先让这一周", "Images let this week return first")) t.periodIntro = "";
  if (includesAny(t.periodImageNote, "图片按日期进入", "已经遇见的图片", "Images enter by date", "already encountered")) t.periodImageNote = locale === "zh" ? "按日期轮动。" : "A rotation by date.";
  if (includesAny(t.periodImageEmpty, "文章可以先继续阅读", "articles from this day remain below")) t.periodImageEmpty = locale === "zh" ? "这一天还没有图片。" : "No image has been received into this day.";
  if (includesAny(t.mediaIntro, "影像只是另一条", "film is another way")) t.mediaIntro = "";
  if (includesAny(t.periodSoundContinue, "换日期时", "声音仍留在水面上", "When the date changes", "sound stays on the water", "sound remains on the water")) t.periodSoundContinue = locale === "zh" ? "声音留在水面上。" : "Sound stays on the water.";
  if (includesAny(t.materialsIntro, "审核钥匙", "review key")) t.materialsIntro = locale === "zh" ? "一份可直接复用的项目结构、数据格式与网站参考。" : "A reusable project structure, data format and selected website references.";
  if (includesAny(t.materialsSourceNote, "源码包", "source package", "审核钥匙", "review key")) t.materialsSourceNote = "";
  if (includesAny(t.sent, "私密审核", "private review")) t.sent = defaultText.sent;
  if (includesAny(t.consent, "私密审核", "private review")) t.consent = locale === "zh" ? "我知道这条链接需要审核。" : "I understand this link needs review.";
  for (const key of ["submitIntro", "consent", "sent", "guestbookIntro", "mediaOfferIntro", "mediaConsent", "mediaPublic", "participantExportIntro", "personalExportIntro", "materialsIntro", "materialsSourceNote"]) {
    t[key] = (t[key] || "")
      .replace(/私密审核/g, "审核")
      .replace(/私密/g, "")
      .replace(/private review/gi, "review")
      .replace(/private media files/gi, "media files")
      .replace(/private review records/gi, "review records")
      .replace(/stay private/gi, "stay unpublished")
      .replace(/is private for review/gi, "is for review");
  }
  t.submitTitle = locale === "zh" ? "反馈" : "Feedback";
  t.submitIntro = locale === "zh" ? "你的反馈只会被项目维护者看见，不会进入公开档案。" : "Your feedback is only visible to the project maintainer; it does not enter the public archive.";
  t.feedbackMessage = locale === "zh" ? "想说的话" : "What would you like to say?";
  t.feedbackContact = locale === "zh" ? "联系方式（选填）" : "Contact details (optional)";
  t.consent = locale === "zh" ? "反馈不会公开显示。" : "Feedback is not displayed publicly.";
  t.send = locale === "zh" ? "送出反馈" : "Send feedback";
  t.sent = locale === "zh" ? "反馈已经收到。" : "Your feedback has arrived.";
  t.queued = locale === "zh" ? "入口暂时没有接住；这份反馈已保存在此设备，稍后会继续送出。" : "The entrance is quiet for now; this feedback is saved on this device and will be sent again later.";
  t.participationTitle = t.submitTitle;
  t.participationReference = locale === "zh" ? "留下反馈" : "Leave feedback";
  t.participationReferenceNote = locale === "zh" ? "不会进入公开档案。" : "It does not enter the public archive.";
  if (includesAny(t.participantExportIntro, "已审核", "reviewed")) t.participantExportIntro = locale === "zh" ? "任何人都可以带走一份当前公开的参与资料；阅读凭证、阅读进度和原始上传文件不会进入这里。" : "Anyone may carry away the participation materials currently public; reading passes, reading progress and original uploads are not included.";
  if (t.submissionPassNote?.includes("更多入口") || t.submissionPassNote?.includes("Further passages")) t.submissionPassNote = defaultText.submissionPassNote;
  if (["被接住的参考", "References already received", "近来提交的见证", "Recent witnesses"].includes(t.community)) t.community = defaultText.community;
  if (["它们已经被接住，也会被后来的人遇见。", "They have been received here, and may be encountered by someone arriving later."].includes(t.communityIntro)) t.communityIntro = defaultText.communityIntro;
  const startupCaption = t.startup || (locale === "zh" ? "档案正在靠近…" : "The archive is approaching…");
  const contentOrder = normalizeContentOrder(siteSettings.contentOrder);
  const contentOrderIndex = (id: ManagedContentId) => contentOrder.indexOf(id);
  activePageCopy = t;
  const percent = total ? Math.round((totalRead / total) * 1000) / 10 : 0;
  const currentIsRead = isReadId(readSet, currentTrace);
  const displayTitle = traceDisplayTitle(currentTrace, locale, locale === "en" ? translation?.title ?? currentTrace.titleEn ?? currentTrace.title : currentTrace.title);
  const displayExcerpt = locale === "en" ? translation?.excerpt ?? currentTrace.excerptEn ?? currentTrace.excerpt : currentTrace.excerpt;
  const progressGroups = [
    { key: "idea", label: typeLabel("idea", locale, t), dot: "idea", total: allTraces.filter((trace) => trace.type === "idea").length, read: allTraces.filter((trace) => trace.type === "idea" && isReadId(readSet, trace)).length },
    { key: "article", label: typeLabel("article", locale, t), dot: "article", total: allTraces.filter((trace) => trace.type === "article").length, read: allTraces.filter((trace) => trace.type === "article" && isReadId(readSet, trace)).length },
    { key: "answer", label: typeLabel("answer", locale, t), dot: "answer", total: allTraces.filter((trace) => trace.type === "answer").length, read: allTraces.filter((trace) => trace.type === "answer" && isReadId(readSet, trace)).length },
    { key: "image", label: t.labelImage, dot: "image", total: approvedImages.length, read: auxiliaryReadCount("image", approvedImages.map((image) => image.id)) },
    { key: "event", label: t.labelEvent, dot: "event", total: publicEventEntries.length, read: auxiliaryReadCount("event", publicEventEntries.map((event) => event.id)) },
    { key: "audio", label: t.labelAudio, dot: "audio", total: approvedAudio.length, read: auxiliaryReadCount("audio", approvedAudio.map((entry) => entry.id)) },
    ...(vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl ? [{ key: "film", label: t.labelFilm, dot: "film", total: 1, read: readSet.has(readableKey("film", "main")) ? 1 : 0 }] : []),
    { key: "link", label: t.labelLink, dot: "link", total: relatedLinks.length, read: auxiliaryReadCount("link", relatedLinks.map((link) => link.id)) },
  ];
  const editable = t;
  const submissionWithParticipant = (body: SubmissionBody): SubmissionBody => {
    const key = passport || localRead(PASSPORT_KEY) || "";
    return /^[A-Za-z0-9_-]{16,80}$/.test(key) ? { ...body, participantKey: key } : body;
  };

  async function submitReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const body = Object.fromEntries(form);
      const delivery = await deliverSubmission("/api/guestbook", body);
      if (delivery.queued) {
        rememberLocalSubmission("/api/guestbook", delivery.id, body, "queued");
        formElement.reset(); setNotice(t.queued); setReferenceReceived(true); setShowWitnessForm(true); triggerTimeGesture("offer"); return;
      }
      const response = delivery.response;
      if (!response) throw new Error(t.error);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      rememberLocalSubmission("/api/guestbook", delivery.id, body, "approved");
      formElement.reset(); setNotice(t.sent); setReferenceReceived(true); setShowWitnessForm(true); triggerTimeGesture("offer");
    } catch (error) { setNotice(error instanceof Error && error.message === "IndexedDB unavailable" ? (locale === "zh" ? "这份资料没有成功保存在本机，请不要关闭页面并再试一次。" : "This could not be saved on this device. Please keep the page open and try again.") : error instanceof Error ? error.message : t.error); }
  }
  async function restore() {
    const key = restoreValue.trim(); if (!/^[A-Za-z0-9_-]{16,80}$/.test(key)) return setNotice(t.error);
    try { const response = await archiveRequest("/api/progress", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, action: "read" }) }); const result = await response.json(); if (!response.ok) throw new Error(); setPassport(key); localWrite(PASSPORT_KEY, key); localWrite(PASSPORT_SEEN_KEY, "yes"); setReadIds(Array.isArray(result.ids) ? result.ids : []); setNotice(t.restored); setPassportPrompt(false); setShowPassport(false); triggerTimeGesture("restore"); } catch { setNotice(t.error); }
  }
  async function copyPassport() { try { await navigator.clipboard?.writeText(passport); localWrite(PASSPORT_SEEN_KEY, "yes"); setNotice(t.copied); triggerTimeGesture("restore"); } catch { setNotice(t.error); } }
  function closePassport() { if (passportPrompt) localWrite(PASSPORT_SEEN_KEY, "yes"); setPassportPrompt(false); setShowPassport(false); }
  function downloadQr() { if (!qrDataUrl) return; const link = document.createElement("a"); link.href = qrDataUrl; link.download = "300-traces-on-site-qr.png"; link.click(); }
  function downloadTextFile(value: string, fileName: string, type: string) {
    const blob = new Blob([value], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  async function downloadPersonalData() {
    setPersonalExporting(true);
    const localRecords = localSubmissionHistory().map((item) => ({ id: item.id, recordKind: item.recordKind, createdAt: item.createdAt, status: item.status, ...item.record }));
    let remoteRecords: Array<Record<string, unknown>> = [];
    try {
      const response = await archiveRequest("/api/participant-export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: passport || localRead(PASSPORT_KEY) || "" }) });
      const result = await response.json();
      if (response.ok && Array.isArray(result.records)) remoteRecords = result.records.filter((item: unknown): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    } catch { /* the local copy remains exportable */ }
    const recordsById = new Map<string, Record<string, unknown>>();
    localRecords.forEach((item) => recordsById.set(String(item.id), item));
    remoteRecords.forEach((item) => { if (typeof item.id === "string") recordsById.set(item.id, item); });
    const records = [...recordsById.values()].sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    const exportedAt = new Date().toISOString();
    const absoluteUrl = (value?: string) => {
      if (!value) return "";
      try { return new URL(value, window.location.href).href; } catch { return value; }
    };
    const encounteredTraces = allTraces.filter((trace) => isReadId(readSet, trace)).map((trace) => ({
      kind: "trace",
      id: idOf(trace),
      archiveNumber: trace.id,
      type: trace.type,
      titleZh: trace.title,
      titleEn: trace.titleEn || "",
      excerptZh: trace.excerpt,
      excerptEn: trace.excerptEn || "",
      author: trace.author || "",
      date: trace.createdAt || "",
      sourceLabel: trace.sourceLabel,
      sourceUrl: absoluteUrl(trace.sourceUrl),
    }));
    const encounteredPeriodArticles = allTraces.filter((trace) => periodArticleReadSet.has(idOf(trace))).map((trace) => ({
      kind: "period-article",
      id: idOf(trace),
      titleZh: trace.title,
      titleEn: trace.titleEn || "",
      excerptZh: trace.excerpt,
      excerptEn: trace.excerptEn || "",
      author: trace.author || "",
      date: trace.createdAt || "",
      sourceLabel: trace.sourceLabel,
      sourceUrl: absoluteUrl(trace.sourceUrl),
    }));
    const encounteredImages = approvedImages.filter((image) => periodImageReadSet.has(image.id)).map((image) => ({
      kind: "image",
      id: image.id,
      date: image.date,
      dateBasis: image.dateBasis,
      titleZh: image.caption,
      titleEn: image.captionEn || "",
      sourceLabel: image.sourceLabel,
      sourceUrl: absoluteUrl(image.sourceUrl),
      imageUrl: absoluteUrl(image.imageUrl),
    }));
    const encounteredEvents = publicEventEntries.filter((event) => readSet.has(readableKey("event", event.id))).map((event) => ({
      kind: "event",
      id: event.id,
      date: event.date,
      titleZh: event.titleZh,
      titleEn: event.titleEn,
      excerptZh: event.excerptZh,
      excerptEn: event.excerptEn,
      sourceLabel: event.sourceLabel,
      sourceUrl: absoluteUrl(event.sourceUrl),
    }));
    const encounteredAudio = approvedAudio.filter((entry) => readSet.has(readableKey("audio", entry.id))).map((entry) => ({
      kind: "audio",
      id: entry.id,
      date: entry.date,
      titleZh: entry.titleZh,
      titleEn: entry.titleEn,
      noteZh: entry.noteZh,
      noteEn: entry.noteEn,
      sourceLabel: entry.sourceLabel,
      sourceUrl: absoluteUrl(entry.sourceUrl),
      playbackUrl: absoluteUrl(entry.playbackUrl),
      downloadUrl: absoluteUrl(entry.downloadUrl),
      license: entry.license || "",
      licenseUrl: absoluteUrl(entry.licenseUrl),
    }));
    const encounteredLinks = relatedLinks.filter((link) => readSet.has(readableKey("link", link.id))).map((link) => ({
      kind: "link",
      id: link.id,
      category: link.kind,
      activityId: link.activityId || "",
      titleZh: link.titleZh,
      titleEn: link.titleEn,
      noteZh: link.noteZh || "",
      noteEn: link.noteEn || "",
      sourceUrl: absoluteUrl(link.url),
    }));
    const encounteredFilm = readSet.has(readableKey("film", "main")) && (vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl) ? [{
      kind: "film",
      id: "main",
      sourceUrl: absoluteUrl(vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl),
      vimeoUrl: absoluteUrl(vimeoUrl),
      zhihuVideoUrl: absoluteUrl(zhihuVideoUrl),
      bilibiliVideoUrl: absoluteUrl(bilibiliVideoUrl),
    }] : [];
    const encounteredMaterials = [
      ...encounteredTraces,
      ...encounteredPeriodArticles,
      ...encounteredImages,
      ...encounteredEvents,
      ...encounteredAudio,
      ...encounteredLinks,
      ...encounteredFilm,
    ];
    const exportPayload = {
      schemaVersion: 2,
      exportedAt,
      project: "300 traces / 300条痕迹",
      scope: "participant-self-export",
      privacy: "Only records linked to this anonymous reading pass are included. The pass itself, anyone else’s records and private review material are excluded.",
      reading: {
        traceIds: readIds,
        periodImageIds: periodImageReadIds,
        periodArticleIds: periodArticleReadIds,
        materials: encounteredMaterials,
        links: [...new Set(encounteredMaterials.flatMap((item) => [
          "sourceUrl" in item ? item.sourceUrl : "",
          "imageUrl" in item ? item.imageUrl : "",
          "playbackUrl" in item ? item.playbackUrl : "",
          "downloadUrl" in item ? item.downloadUrl : "",
          "vimeoUrl" in item ? item.vimeoUrl : "",
          "zhihuVideoUrl" in item ? item.zhihuVideoUrl : "",
          "bilibiliVideoUrl" in item ? item.bilibiliVideoUrl : "",
        ].filter(Boolean)))],
      },
      records,
    };
    const date = exportedAt.slice(0, 10);
    downloadTextFile(JSON.stringify(exportPayload, null, 2), `300-traces-my-traces-${date}.json`, "application/json;charset=utf-8");
    const lines = ["# 300条痕迹 · 我的足迹与见证", "", `导出时间：${exportedAt}`, "", "## 阅读足迹", "", `- 总痕迹：${readIds.length} 条`, `- 时间层图片：${periodImageReadIds.length} 张`, `- 时间层文章：${periodArticleReadIds.length} 篇`, "", "## 我遇见过的内容", ""];
    if (!encounteredMaterials.length) lines.push(t.personalExportEmpty);
    encounteredMaterials.forEach((item) => {
      const title = "titleZh" in item ? item.titleZh : item.kind;
      const sourceUrl = "sourceUrl" in item ? item.sourceUrl : "";
      lines.push(`### ${String(title)}`, "", `- 类型：${String(item.kind)}`, `- 编号：${String(item.id)}`);
      if ("date" in item && item.date) lines.push(`- 日期：${String(item.date)}`);
      if (sourceUrl) lines.push(`- 来源链接：${String(sourceUrl)}`);
      if ("imageUrl" in item && item.imageUrl) lines.push(`- 图片文件：${String(item.imageUrl)}`);
      if ("playbackUrl" in item && item.playbackUrl) lines.push(`- 播放链接：${String(item.playbackUrl)}`);
      if ("downloadUrl" in item && item.downloadUrl) lines.push(`- 下载链接：${String(item.downloadUrl)}`);
      lines.push("");
    });
    lines.push("## 我留下的见证", "");
    if (!records.length) lines.push(t.personalExportEmpty);
    records.forEach((record) => {
      lines.push(`### ${String(record.recordKind || "witness")} · ${String(record.title || record.message || record.url || record.id)}`, "", `- 状态：${String(record.status || "")}`, `- 时间：${String(record.createdAt || "")}`);
      if (record.url) lines.push(`- 链接：${String(record.url)}`);
      if (record.excerpt) lines.push(`- 摘要：${String(record.excerpt)}`);
      if (record.reason) lines.push(`- 添加理由：${String(record.reason)}`);
      if (record.message) lines.push(`- 留言：${String(record.message)}`);
      lines.push("");
    });
    downloadTextFile(lines.join("\n"), `300-traces-my-traces-${date}.md`, "text/markdown;charset=utf-8");
    setPersonalExporting(false);
    setPersonalExported(true);
    setNotice(t.personalExported);
    triggerTimeGesture("export");
  }
  function toggleAudio() {
    if (!atmosphere.audio) return;
    triggerTimeGesture("sound");
    setNotice("");
    if (!audio.current) {
      audio.current = new Audio(atmosphere.audio);
      audio.current.loop = true;
      audio.current.addEventListener("error", () => {
        setNotice(locale === "zh" ? "环境声音暂时无法加载，请稍后再试。" : "The ambient sound could not load. Please try again later.");
      });
    }
    if (audio.current.paused) {
      void audio.current.play().catch(() => {
        setNotice(locale === "zh" ? "环境声音暂时无法加载，请稍后再试。" : "The ambient sound could not load. Please try again later.");
      });
    } else audio.current.pause();
  }
  function togglePeriodSound(entry: PeriodAudio) {
    const player = periodSoundElement.current;
    if (!player || !entry.playbackUrl) return;
    triggerTimeGesture("sound");
    setPeriodSoundError("");
    setNotice("");
    const source = new URL(entry.playbackUrl, window.location.href).href;
    if (periodSoundId !== entry.id || player.src !== source || player.error) {
      player.src = source;
      player.load();
      setPeriodSoundId(entry.id);
      void player.play().catch(() => { const message = locale === "zh" ? "声音暂时无法加载，可以打开声音来源或稍后再试。" : "The sound could not load. Open its source or try again later."; setPeriodSoundPlaying(false); setPeriodSoundError(message); setNotice(message); });
      return;
    }
    if (player.paused) void player.play().catch(() => { const message = locale === "zh" ? "声音暂时无法加载，可以打开声音来源或稍后再试。" : "The sound could not load. Open its source or try again later."; setPeriodSoundPlaying(false); setPeriodSoundError(message); setNotice(message); });
    else player.pause();
  }
  const periodSoundLayer = (
    <section className="period-sound-layer" style={{ order: contentOrderIndex("secondary") - 0.5 }} aria-labelledby="period-sound-heading">
      <div className="section-heading"><div><p className="eyebrow">{t.periodSoundTitle}</p><h2 id="period-sound-heading">{formatPeriodDate(selectedPeriod.date, locale)}</h2></div><span className="period-intro">{t.periodSoundNote}</span></div>
      {periodAudioEntries.length ? <div className="period-sound-list">{periodAudioEntries.map((entry) => <article className="period-sound-card" key={entry.id}><span className="period-sound-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span><div><span className="period-fragment-meta">{entry.sourceLabel} · {entry.duration}</span><h3>{locale === "en" ? entry.titleEn : entry.titleZh}</h3><p>{locale === "en" ? entry.noteEn : entry.noteZh}</p>{entry.playbackUrl && <button className={`period-sound-play ${periodSoundId === entry.id && periodSoundPlaying ? "is-playing" : ""}`} type="button" onClick={() => { markContentRead("audio", entry.id); togglePeriodSound(entry); }} aria-pressed={periodSoundId === entry.id && periodSoundPlaying}>{periodSoundId === entry.id && periodSoundPlaying ? t.silence : t.periodSoundPlay} <span aria-hidden="true">◌</span></button>}</div><div className="period-sound-actions"><ReadToggleButton text={t} isRead={readSet.has(readableKey("audio", entry.id))} onMarkRead={() => markContentRead("audio", entry.id)} /><a href={entry.sourceUrl} target="_blank" rel="noreferrer" onClick={() => markContentRead("audio", entry.id)}>{t.periodSoundOpen} ↗</a>{entry.downloadUrl && <a className="sound-download" href={entry.downloadUrl} target="_blank" rel="noreferrer" onClick={() => markContentRead("audio", entry.id)}>{t.periodSoundDownload} ↓</a>}{entry.licenseUrl && entry.license && <a className="sound-license" href={entry.licenseUrl} target="_blank" rel="noreferrer" onClick={() => markContentRead("audio", entry.id)}>{t.periodSoundLicense}: {entry.license}</a>}</div></article>)}</div> : <p className="period-empty">{t.periodSoundEmpty}</p>}
      <div className={`period-sound-continuity ${periodSoundEntry ? "is-active" : ""}`} aria-live="polite"><div><span className="period-fragment-meta">{t.periodSoundContinue}</span>{periodSoundEntry && <strong>{locale === "en" ? periodSoundEntry.titleEn : periodSoundEntry.titleZh}</strong>}{periodSoundError && <span className="period-sound-error" role="status">{periodSoundError}</span>}{periodSoundError && periodSoundEntry?.sourceUrl && <a className="sound-error-link" href={periodSoundEntry.sourceUrl} target="_blank" rel="noreferrer" onClick={() => markContentRead("audio", periodSoundEntry.id)}>{t.periodSoundOpen} ↗</a>}</div><audio ref={periodSoundElement} className="period-sound-continuity-player" controls preload="none" aria-label={periodSoundEntry ? `${t.periodSoundPlay}: ${locale === "en" ? periodSoundEntry.titleEn : periodSoundEntry.titleZh}` : t.periodSoundPlay} /></div>
    </section>
  );
  const handleReadableClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const anchor = target.closest<HTMLAnchorElement>("a");
    if (anchor?.target === "_blank" && !anchor.closest(".media-entrance") && !anchor.closest(".related-links-section") && !anchor.closest(".period-sound-card")) {
      if (anchor.closest(".vimeo-preview") || anchor.closest(".media-source-card")) markContentRead("film", "main");
      else if (anchor.closest(".period-image-card")) markContentRead("image", currentPeriodImage?.id || "");
      else if (anchor.classList.contains("period-fragment-main")) {
        const trace = currentPeriodArticles.find((item) => item.sourceUrl === anchor.getAttribute("href"));
        if (trace) markTraceRead(trace);
      } else if (anchor.classList.contains("period-event-main")) {
        const entry = periodEventEntries.find((item) => item.sourceUrl === anchor.getAttribute("href"));
        if (entry) markContentRead("event", entry.id);
      } else if (anchor.classList.contains("recent-witness-main")) {
        const item = community.find((candidate) => candidate.url === anchor.getAttribute("href"));
        if (item) markTraceRead(asTrace(item, 0, sourceTraces.length));
      } else if (anchor.closest(".related-link")) {
        const link = relatedLinks.find((candidate) => candidate.url === anchor.getAttribute("href"));
        if (link) markContentRead("link", link.id);
      } else if (anchor.closest(".period-sound-card")) {
        const entry = periodAudioEntries.find((candidate) => [candidate.sourceUrl, candidate.playbackUrl, candidate.downloadUrl, candidate.licenseUrl].includes(anchor.getAttribute("href") || ""));
        if (entry) markContentRead("audio", entry.id);
      } else if (anchor.closest(".trace-card")) markTraceRead(currentTrace);
    }
  };
  const countryAcknowledgement = (
    <>
      <SurrealClockField />
      {timeGesture && <div key={timeGesture.seed} className={`interaction-time-echo motif-${timeGesture.motif}`} style={{ "--time-echo-tilt": `${timeGesture.tilt}deg` } as CSSProperties} role="status" aria-live="polite">{timeGesture.motif !== "candle" && <div className="interaction-hourglass" aria-hidden="true"><span className="interaction-hourglass-glass"><i className="interaction-hourglass-sand interaction-hourglass-sand-top" /><i className="interaction-hourglass-sand interaction-hourglass-sand-bottom" /><i className="interaction-hourglass-stream" /></span></div>}{timeGesture.motif !== "sand" && <div className="candle-object" aria-hidden="true"><i className="candle-flame" /><span className="candle-wick" /><span className="candle-wax" /><i className="candle-drip" /></div>}<span>{timeGestureLabel(timeGesture.gesture, t)}</span></div>}
      {!IS_MAINLAND_BUILD && <section className="country-acknowledgement" aria-labelledby="country-acknowledgement-heading">
        <div className="country-flag-pair" aria-label={t.countryFlagAlt}>
          <div className="country-flag-mark" role="img" aria-label={locale === "zh" ? "澳大利亚原住民旗帜色彩" : "Australian Aboriginal Flag colours"}><span aria-hidden="true" /></div>
          <div className="country-flag-mark torres-flag-mark" role="img" aria-label={locale === "zh" ? "托雷斯海峡岛民旗帜色彩" : "Torres Strait Islander Flag colours"}><span aria-hidden="true">✦</span></div>
        </div>
        <div><p className="eyebrow">{t.countryTitle}</p><h2 id="country-acknowledgement-heading">{t.countryTitle}</h2><p>{t.countryText}</p><a href="https://www.indigenous.gov.au/acknowledgement-country" target="_blank" rel="noreferrer">{t.countryLinkText} ↗</a></div>
      </section>}
    </>
  );
  const riverLayer = <RiverLayer text={t} authors={riverAuthors} />;

  function openFeedback() {
    triggerTimeGesture("offer");
    setReferenceReceived(false);
    setFeedbackRating(0);
    setShowWitnessForm(true);
  }
  function closeFeedback() {
    setShowWitnessForm(false);
    setReferenceReceived(false);
  }
  const referenceContributionForm = (
    <form className="reference-form contribution-form" onSubmit={submitReference}>
      <h3>{t.submitTitle}</h3>
      <p>{t.submitIntro}</p>
      <div className="feedback-rating" role="group" aria-labelledby="feedback-rating-label">
        <span id="feedback-rating-label">{locale === "zh" ? "这次相遇如何？" : "How was this encounter?"}</span>
        <input type="hidden" name="rating" value={feedbackRating} />
        <div className="feedback-stars">{[1, 2, 3, 4, 5].map((star) => <button className={star <= feedbackRating ? "is-selected" : ""} type="button" key={star} onClick={() => setFeedbackRating(star)} aria-label={locale === "zh" ? `${star} 星` : `${star} star${star === 1 ? "" : "s"}`} aria-pressed={star <= feedbackRating}>★</button>)}</div>
      </div>
      <label data-field-note={locale === "zh" ? "（选填）" : "(optional)"}>{t.feedbackMessage}<textarea name="message" maxLength={1600} rows={4} /></label>
      <label data-field-note={locale === "zh" ? "（选填）" : "(optional)"}>{t.feedbackContact}<input name="contact" maxLength={240} /></label>
      <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <p className="consent-note">{t.consent}</p>
      <button className="submit-button" type="submit" disabled={!feedbackRating}>{t.send}</button>
    </form>
  );
  const feedbackDialog = showWitnessForm && (
    <div className="dialog-backdrop feedback-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeFeedback(); }}>
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
        <button className="dialog-close" onClick={closeFeedback} type="button" aria-label={t.dialogClose}>×</button>
        {!referenceReceived ? <>
          <p className="eyebrow">{locale === "zh" ? "FEEDBACK" : "FEEDBACK"}</p>
          <h2 id="feedback-dialog-title">{t.participationReference}</h2>
          {referenceContributionForm}
        </> : <div className="feedback-received" role="status">
          <span aria-hidden="true">◌</span>
          <div><h2 id="feedback-dialog-title">{t.receivedTitle}</h2><p>{notice || t.sent}</p><button className="read-button" type="button" onClick={closeFeedback}>{locale === "zh" ? "回到档案" : "Return to the archive"}</button></div>
        </div>}
      </section>
    </div>
  );
  const secondarySection = (
    <section className="secondary-section" data-content-section="secondary" style={{ order: contentOrderIndex("secondary") }} aria-labelledby="secondary-heading">
      <button className="secondary-toggle" type="button" aria-expanded={showSecondary} aria-controls="secondary-panel" onClick={() => { setShowSecondary((open) => !open); triggerTimeGesture("encounter"); }}><span><span className="eyebrow">{t.secondaryTitle}</span><strong id="secondary-heading">{showSecondary ? t.secondaryClose : t.secondaryOpen}</strong></span><span className="secondary-toggle-mark" aria-hidden="true">{showSecondary ? "−" : "+"}</span></button>
      {!showSecondary && t.secondaryIntro && <p className="secondary-preview">{t.secondaryIntro}</p>}
      {showSecondary && <div className="secondary-panel" id="secondary-panel">
        {relatedLinks.length > 0 && <RelatedLinksSection text={t} locale={locale} links={relatedLinks} order={0} readSet={readSet} onMarkRead={(id) => markContentRead("link", id)} />}
        <section className="participant-export-section" aria-labelledby="participant-export-heading"><p className="eyebrow">{t.exportTitle}</p><h2 id="participant-export-heading">{t.exportTitle}</h2>{t.exportIntro && <p>{t.exportIntro}</p>}<div className="participant-export-actions"><article className="participant-export-option"><h3>{t.personalExportTitle}</h3><p>{t.personalExportIntro}</p><button className="read-button" type="button" disabled={personalExporting} onClick={() => void downloadPersonalData()}>{personalExporting ? t.personalExporting : t.personalExportButton} <span aria-hidden="true">↓</span></button>{personalExported && <p className="save-feedback" role="status">{t.personalExported}</p>}</article></div></section>
        <details className="project-materials-section" aria-labelledby="project-materials-heading"><summary className="project-materials-toggle"><span className="project-materials-summary"><span className="eyebrow">{t.materialsTitle}</span><strong id="project-materials-heading">{t.materialsTitle}</strong></span><span className="project-materials-mark" aria-hidden="true">＋</span></summary><div className="project-materials-content"><div className="project-materials-links"><a className="offer-button" href="https://github.com/Annoymity00999/300-traces-template" target="_blank" rel="noreferrer">{t.materialsSource} <span aria-hidden="true">↗</span></a></div>{t.materialsSourceNote && <p className="project-materials-note">{t.materialsSourceNote}</p>}</div></details>
      </div>}
    </section>
  );

  return (
    <>
      {startupPhase !== "done" && <StartupClock phase={startupPhase} caption={startupCaption} />}
      <main className={`archive-shell ${startupPhase === "done" ? "is-ready" : "is-loading"} ${atmosphere.image ? "has-image" : ""} ${cinemaMode ? "is-cinema-shell" : ""}`} style={{ ...(atmosphere.image ? { "--archive-image": `url(${atmosphere.image})` } : {}), "--archive-image-opacity": String(siteSettings.backgroundOpacity ?? 0.15) } as CSSProperties}>
      <header className="site-header"><span className="wordmark" aria-label={t.archive}><span className="wordmark-mark" aria-hidden="true">◌</span><span>{t.archive}</span></span><div className="header-tools"><button className="language-switch" type="button" onClick={() => { triggerTimeGesture("language"); setLocale(locale === "zh" ? "en" : "zh"); }}>{locale === "zh" ? "EN" : "中文"}</button><button className="quiet-link" type="button" onClick={() => { triggerTimeGesture("restore"); setPassportPrompt(false); setShowPassport(true); }}>{t.device}</button><a className="instruction-library-link quiet-link" href="/instruction-library" aria-label={locale === "zh" ? "指令库" : "Instruction library"}>{locale === "zh" ? "指令库" : "Instructions"}</a><button className="quiet-link" type="button" aria-haspopup="dialog" aria-expanded={showInstruction} onClick={() => setShowInstruction(true)}>{locale === "zh" ? "指令" : "Instruction"}</button><button className="quiet-link" type="button" onClick={() => { triggerTimeGesture("encounter"); setShowQr(true); }}>{t.qr}</button><button className="feedback-header-entry" type="button" aria-haspopup="dialog" aria-expanded={showWitnessForm} onClick={openFeedback}>{locale === "zh" ? "反馈" : "Feedback"}</button></div></header>
      <div className="archive-content" id="top" onClick={handleReadableClick}>
        <section className="intro-block"><MediaEntrance key={vimeoUrl || zhihuVideoUrl || bilibiliVideoUrl} text={t} vimeoUrl={vimeoUrl} zhihuVideoUrl={zhihuVideoUrl} bilibiliVideoUrl={bilibiliVideoUrl} cinemaMode={cinemaMode} onCinemaModeChange={setCinemaMode} isRead={readSet.has(readableKey("film", "main"))} onMarkRead={() => markContentRead("film", "main")} /><p className="eyebrow">{editable.eyebrow}</p><h1>{editable.headingLead}<em>{editable.headingEmphasis}</em>{editable.headingTail}</h1><p className="intro-copy">{editable.intro}</p></section>
        <>
        {riverLayer}
        <section className="progress-section"><div className="section-heading"><div><p className="eyebrow">{t.footprint}</p><h2>{t.met}</h2></div><div className="progress-total"><strong>{totalRead}</strong><span> / {total}</span></div></div><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-meta"><span>{percent}% {t.held}</span><span>{t.cloud}</span></div><p className="progress-scope">{t.progressScope}</p><div className="type-progress-grid">{progressGroups.map((group) => <div className="type-progress" key={group.key}><div className="type-progress-label"><span className={`type-dot type-dot-${group.dot}`} /><span>{group.label}</span><span className="type-count">{group.read} / {group.total}</span></div><div className="type-track"><span style={{ width: `${group.total ? group.read / group.total * 100 : 0}%` }} /></div></div>)}</div></section>
        <div className="managed-content-order">
        <section className="period-section" data-content-section="period" style={{ order: contentOrderIndex("period") }} aria-labelledby="period-heading"><div className="section-heading"><div><p className="eyebrow">{t.periodTitle}</p><h2 id="period-heading">{t.periodHeading}</h2></div><span className="period-intro">{t.periodIntro}</span></div><div className="period-timeline" role="tablist" aria-label={t.periodTitle}>{periodEntries.map((entry) => <button key={entry.date} className={entry.date === selectedPeriod.date ? "is-active" : ""} type="button" role="tab" aria-selected={entry.date === selectedPeriod.date} onClick={() => setPeriodDate(entry.date)}><span>{formatPeriodDate(entry.date, locale)}</span><small>{entry.traces.length}</small></button>)}</div><div className="period-image-layer"><div className="section-heading"><div><p className="eyebrow">{t.periodImageTitle}</p><span className="period-image-note">{t.periodImageNote}</span></div><span className="period-image-date">{formatPeriodDate(selectedPeriod.date, locale)}</span></div>{currentPeriodImage ? <figure className="period-image-card"><div className="period-image-stack"><a className="period-image-primary" href={currentPeriodImage.sourceUrl} target="_blank" rel="noreferrer"><img src={currentPeriodImage.imageUrl} alt={locale === "en" ? currentPeriodImage.altEn || currentPeriodImage.alt || currentPeriodImage.caption : currentPeriodImage.alt || currentPeriodImage.caption} loading={selectedPeriod.date === INITIAL_PERIOD_DATE ? "eager" : "lazy"} decoding="async" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.closest(".period-image-primary")?.classList.add("is-unavailable"); }} /><span className="image-unavailable">{locale === "en" ? "Image temporarily unavailable" : "图片暂时无法加载"}</span></a></div><figcaption><div><strong>{locale === "en" ? currentPeriodImage.captionEn || currentPeriodImage.caption : currentPeriodImage.caption}</strong><small>{t.periodImageCredit}: {locale === "en" ? currentPeriodImage.creditEn || currentPeriodImage.credit || currentPeriodImage.sourceLabel : currentPeriodImage.credit || currentPeriodImage.sourceLabel}</small></div><div className="period-content-actions"><a href={currentPeriodImage.sourceUrl} target="_blank" rel="noreferrer">{t.periodImageOpen} ↗</a><ReadToggleButton text={t} isRead={readSet.has(readableKey("image", currentPeriodImage.id))} onMarkRead={() => markContentRead("image", currentPeriodImage.id)} /></div></figcaption></figure> : <div className="period-image-empty"><p>{t.periodImageEmpty}</p>{firstPeriodImageDate && firstPeriodImageDate !== selectedPeriod.date && <button className="read-button" type="button" onClick={() => setPeriodDate(firstPeriodImageDate)}>{locale === "zh" ? `前往有图片的${formatPeriodDate(firstPeriodImageDate, locale)}` : `Go to ${formatPeriodDate(firstPeriodImageDate, locale)}`}</button>}</div>}<div className="period-image-controls"><button className="draw-button" disabled={!periodImagePool.length} onClick={drawPeriodImage} type="button"><span aria-hidden="true">↻</span> {t.periodImageRandom}</button><span>{periodImageReadIds.length} {t.periodImageSeen}</span></div></div><div className="period-memory"><div className="period-article-heading"><div><p className="eyebrow">{locale === "zh" ? "日期文章" : "Articles by date"}</p><span className="period-image-note">{locale === "zh" ? "文章仍按日期留在这里；刷新时优先交来尚未遇见的篇目。" : "The articles remain here by date; refreshing offers pieces you have not yet encountered first."}</span></div><button className="draw-button period-article-refresh" disabled={!periodArticlePool.length} onClick={drawPeriodArticles} type="button"><span aria-hidden="true">↻</span> {locale === "zh" ? "遇见另一组文章" : "Meet another set of articles"}</button></div>{selectedPeriod.traces.length ? <><div className="period-article-meta"><p className="period-date">{formatPeriodDate(selectedPeriod.date, locale)} · {selectedPeriod.traces.length} {t.periodCount}</p><span>{periodArticleReadIds.filter((id) => periodArticlePool.some((trace) => idOf(trace) === id)).length} {locale === "zh" ? "篇已经遇见" : "already encountered"}</span></div><div className="period-fragments">{currentPeriodArticles.map((trace) => <article className="period-fragment" key={trace.sourceId || trace.id}><a className="period-fragment-main" href={trace.sourceUrl} target="_blank" rel="noreferrer"><span className="period-fragment-meta">{trace.sourceLabel}{trace.author ? ` · ${trace.author}` : ""}</span><strong>{traceDisplayTitle(trace, locale)}</strong><span>{locale === "en" ? trace.excerptEn || trace.excerpt : trace.excerpt}</span></a><ReadToggleButton text={t} isRead={isReadId(readSet, trace)} onMarkRead={() => markTraceRead(trace)} /></article>)}</div></> : <p className="period-empty">{t.periodEmpty}</p>}<div className="period-events" aria-labelledby="period-events-heading"><div className="period-article-heading"><div><p className="eyebrow" id="period-events-heading">{t.periodEventsTitle}</p><span className="period-image-note">{t.periodEventsNote}</span></div><span className="period-events-count">{periodEventEntries.length}</span></div>{periodEventEntries.length ? <div className="period-event-list">{periodEventEntries.map((event) => <article className="period-event" key={event.id}><a className="period-event-main" href={event.sourceUrl} target="_blank" rel="noreferrer"><span className="period-fragment-meta">{event.sourceLabel} · {event.status}</span><strong>{locale === "en" ? event.titleEn : event.titleZh}</strong><span>{locale === "en" ? event.excerptEn : event.excerptZh}</span><b>{t.periodEventOpen} ↗</b></a><ReadToggleButton text={t} isRead={readSet.has(readableKey("event", event.id))} onMarkRead={() => markContentRead("event", event.id)} /></article>)}</div> : <p className="period-empty">{t.periodEventEmpty}</p>}</div></div></section>
        <section className="encounter-section" data-content-section="encounter" style={{ order: contentOrderIndex("encounter") }}><div className="encounter-topline"><div><p className="eyebrow">{t.next}</p><h2>{filter === "all" ? t.all : typeLabel(filter, locale)}</h2></div><span className="sample-status">{t.status}</span></div><div className="filter-row">{(["all", "idea", "article", "answer"] as Filter[]).map((item) => <button className={`filter-button ${filter === item ? "is-active" : ""}`} key={item} onClick={() => chooseFilter(item)} type="button">{item === "all" ? (locale === "zh" ? "全部" : "All") : typeLabel(item, locale)}</button>)}</div>
          <div className="trace-card" aria-live="polite"><div className="trace-card-header"><span className="trace-number">{formatId(currentTrace.id)} / {archiveTotal}</span><span className={`trace-type trace-type-${currentTrace.type}`}><span className="type-dot" /> {typeLabel(currentTrace.type, locale)}</span></div><div className="trace-card-body"><p className="trace-source">{currentTrace.sourceLabel === "新的参考" ? t.source : currentTrace.sourceLabel}{currentTrace.author ? ` · ${currentTrace.author}` : ""}</p><h3>{displayTitle}</h3><p className="trace-excerpt">“{displayExcerpt}”</p>{locale === "en" && !translation && !currentTrace.titleEn && <p className="translation-note">{isTranslating ? t.translateLoading : t.translationNote}</p>}<div className="topic-list">{currentTrace.topics?.map((topic) => <span key={topic}>#{topic}</span>)}</div></div><div className="trace-card-actions"><a className="open-button" href={currentTrace.sourceUrl} target="_blank" rel="noreferrer">{t.open} <span aria-hidden="true">↗</span></a><ReadToggleButton text={t} isRead={currentIsRead} onMarkRead={() => markTraceRead(currentTrace)} /></div></div>
          <button className="draw-button" onClick={() => draw()} type="button"><span aria-hidden="true">↻</span> {t.draw}</button><p className="encounter-note">{t.note}</p></section>
        {periodSoundLayer}
        {secondarySection}
        </div>
        {atmosphere.audio && <button className="sound-button" type="button" onClick={toggleAudio}>{audio.current?.paused === false ? t.silence : t.audio} <span aria-hidden="true">◌</span></button>}
        {notice && <p className="notice" role="status">{notice}</p>}
        {countryAcknowledgement}
        <footer className="archive-footer"><span>{editable.footerLeft}</span><span>{editable.footerRight}</span></footer></>
      </div>
      {showPassport && <div className="dialog-backdrop" role="presentation"><section className="passport-dialog" role="dialog" aria-modal="true"><button className="dialog-close" onClick={closePassport} type="button" aria-label="Close">×</button><p className="eyebrow">{t.passport}</p><h2>{passportPrompt && locale === "zh" ? "先留下一枚凭证。" : passportPrompt ? "Keep a small pass." : t.passportTitle}</h2><p>{t.passportIntro}</p><code>{passport}</code><button className="read-button" type="button" onClick={copyPassport}>{t.copy}</button>{passportPrompt && <button className="quiet-dialog-button" type="button" onClick={closePassport}>{locale === "zh" ? "我已经记下了" : "I have kept it"}</button>}<hr /><label>{t.restoreLabel}<input value={restoreValue} onChange={(event) => setRestoreValue(event.target.value)} /></label><button className="open-button" type="button" onClick={restore}>{t.restoreButton}</button></section></div>}
      {showQr && <div className="dialog-backdrop" role="presentation"><section className="qr-dialog" role="dialog" aria-modal="true" aria-labelledby="qr-title"><button className="dialog-close" onClick={() => setShowQr(false)} type="button" aria-label={t.dialogClose}>×</button><p className="eyebrow">{t.qr}</p><h2 id="qr-title">{t.qrTitle}</h2><p>{t.qrIntro}</p>{qrDataUrl ? <img className="qr-code" src={qrDataUrl} alt={`${t.qrTitle} QR code`} /> : <div className="qr-loading" aria-busy="true">{qrError ? t.error : t.qrPreparing}</div>}{qrDataUrl && <button className="read-button" type="button" onClick={downloadQr}>{t.qrDownload}</button>}</section></div>}
      {showInstruction && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstruction(false); }}><section className="passport-dialog instruction-dialog" role="dialog" aria-modal="true" aria-labelledby="instruction-title"><button className="dialog-close" onClick={() => setShowInstruction(false)} type="button" aria-label={t.dialogClose}>×</button><p className="eyebrow">{locale === "zh" ? "指令" : "INSTRUCTION"}</p><h2 id="instruction-title">{locale === "zh" ? "在知乎 @ 一位和你的 3 月 16 日—3 月 22 日有关的人。" : "On Zhihu, @-mention someone connected to your 16–22 March."}</h2><a className="quiet-dialog-button" href="/instruction-library">{locale === "zh" ? "前往指令库" : "Open instruction library"}</a></section></div>}
      </main>
      {feedbackDialog}
    </>
  );
}
