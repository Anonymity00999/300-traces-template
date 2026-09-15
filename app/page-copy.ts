export type CopyLocale = "zh" | "en";

/**
 * These are reader-facing invariants rather than editable programme notes.
 * Keeping them here means the public reader and the legacy workspace begin
 * from the same wording, even when an older remote settings snapshot exists.
 */
export function readerSurfaceCopy(locale: CopyLocale, total: number): Record<string, string> {
  return locale === "zh" ? {
    progressScope: "", periodSoundNote: "", periodSoundContinue: "",
    personalExportIntro: "用户码 · 浏览资料 · 打开时间 · 本人见证",
    timeGestureExport: "足迹已带走",
    intro: `这里保存了 ${total} 条从 2026 年三月第三周出发的阅读痕迹。随机遇见，或沿着某一种形式靠近它们。`,
    submitTitle: "反馈",
    submitIntro: "",
    feedbackRating: "欢迎评价本次活动",
    feedbackMessage: "更多留言",
    feedbackContact: "联系邮箱",
    consent: "",
    send: "送出反馈",
    sent: "反馈已经收到。",
    queued: "入口暂时没有接住；这份反馈已保存在此设备，稍后会继续送出。",
    participationTitle: "反馈",
    participationReference: "留下反馈",
    participationReferenceNote: "",
    linksOpen: "穿梭",
    materialsSource: "查看 GitHub 模板",
    periodImageSeen: "曾在这里显现",
    periodArticleSeen: "已在这里出现",
    countryTitle: "原住民土地致意",
    countryText: "本网站于 Gadigal Country 上建构。我们向 Gadigal 人及澳大利亚各地的 Aboriginal and Torres Strait Islander peoples 致意，尊重他们与 Country 的持续联系，并向过去与现在的长者致敬。",
  } : {
    progressScope: "", periodSoundNote: "", periodSoundContinue: "",
    personalExportIntro: "User code · Browsed materials · Opening dates · Your witnesses",
    timeGestureExport: "Your traces have been carried away",
    intro: `This archive holds ${total} reading traces gathered around the third week of March 2026. Meet one at random, or move closer through a chosen form.`,
    submitTitle: "Feedback",
    submitIntro: "",
    feedbackRating: "You are welcome to rate this encounter",
    feedbackMessage: "More to say",
    feedbackContact: "Email",
    consent: "",
    send: "Send feedback",
    sent: "Your feedback has arrived.",
    queued: "The entrance is quiet for now; this feedback is saved on this device and will be sent again later.",
    participationTitle: "Feedback",
    participationReference: "Leave feedback",
    participationReferenceNote: "",
    linksOpen: "Pass through",
    materialsSource: "Open GitHub template",
    periodImageSeen: "shown here before",
    periodArticleSeen: "shown here before",
    countryTitle: "Acknowledgement of Country",
    countryText: "This website was built on Gadigal Country. We acknowledge the Gadigal people and Aboriginal and Torres Strait Islander peoples across Australia, their continuing connections to Country, and Elders past and present.",
  };
}

const defaults: Record<CopyLocale, Record<string, string>> = {
  zh: {
    archive: "300条痕迹", startup: "档案正在靠近…", device: "云端正在接住", qr: "现场二维码", qrTitle: "让它在现场被遇见", qrIntro: "请用手机相机扫描；它会带你回到此刻的阅读入口。", qrDownload: "下载二维码", qrPreparing: "正在留下入口…",
    eyebrow: "一份可被遇见的阅读档案", footprint: "你的阅读足迹", met: "已经与你相遇", held: "的痕迹已经被你接住", cloud: "足迹状态", cloudLocal: "足迹留在此设备", cloudSyncing: "足迹正在向云端靠近", cloudSynced: "足迹已在云端留下一份副本", cloudWaiting: "足迹已保存在此设备，稍后会继续同步", next: "下一次靠近", all: "全部痕迹", status: "真实档案 · 可继续补入", open: "穿梭", read: "标记为读过", readAlready: "已经读过", draw: "遇见一条未读痕迹", note: "默认优先把尚未读过的痕迹交到你手里。", footer: "阅读是一种接住。", offer: "交来一条参考", passport: "取回 / 保存阅读凭证", original: "中文原文", translationNote: "保留原文；此浏览器暂不能生成英文译文。", translateLoading: "正在靠近英文…", source: "新的参考", labelIdea: "想法", labelArticle: "文章", labelAnswer: "回答", labelImage: "图片", labelEvent: "事件", labelAudio: "声音", labelFilm: "影像", labelLink: "入口", progressScope: "总进度包含档案文本、时间层图片、事件、声音、影像与入口；“遇见”不等于“读过”。",
    submitTitle: "交来一条参考", submitIntro: "只需一个链接；其他信息可选。", link: "文章链接", date: "发布日期", title: "标题", excerpt: "短摘录", reason: "为什么想把它交来", consent: "我理解：它只会先被私密审核，不会自动公开。", send: "把它交来", close: "暂时收起", sending: "正在放下…", sent: "已经收到。它正在等待被接住。", queued: "入口暂时没有接住；这份资料已保存在此设备，稍后会继续交来。", passportTitle: "一枚阅读凭证", passportIntro: "保存这串凭证。清除浏览记录或换设备后，用它可以取回你的足迹。", restore: "取回足迹", copy: "复制", copied: "已复制", restoreLabel: "输入你保存的阅读凭证", restoreButton: "接回足迹", restored: "足迹已经回到这里。", error: "暂时没有接住，请稍后再试。", imageAlt: "背景中的一条痕迹", audio: "接住声音", silence: "放回安静",
    community: "实时新增", communityIntro: "已经接住的内容，会在这里出现。", linksTitle: "一些相遇", linksIntro: "个人作品与社区创作。", linksWork: "以斯帖的晨祷 · 个人作品", linksCommunity: "社区创作", linksOpen: "穿梭", linksEmpty: "链接还在等待被放下。", guestbook: "留下几句话", guestbookIntro: "不必署名。被审核接住以后，它会和后来到来的人相遇。", guestbookMessage: "想留下的话", guestbookName: "名字（选填）", guestbookAnonymous: "匿名", guestbookSend: "留下这句话", guestbookSending: "正在留下…", guestbookSent: "这句话已经收到，正在等待被接住。", guestbookEmpty: "还没有人把话留在这里。",
    periodTitle: "时间层 · 2026.03.16–22", periodHeading: "回到那一周", periodIntro: "", periodCount: "条痕迹", periodEmpty: "这一天还没有留下可显示的片段。", periodImageTitle: "图片轮动层", periodImageNote: "按日期轮动。", periodImageRandom: "遇见另一张图片", periodImageOpen: "穿梭", periodImageCredit: "来源 / 说明", periodImageEmpty: "这一天还没有图片。", periodImageSeen: "已经遇见",
    periodEventsTitle: "这一天，也发生了", periodEventsNote: "把新闻、公共日历、天文与生态信号并置；它不是一份完整新闻摘要。", periodEventEmpty: "这一天暂时没有被收进来的事件。", periodEventOpen: "穿梭", eventOffer: "投稿当天事件", eventOfferIntro: "留下日期与来源链接；其余可以空着。审核通过后，它会进入这一天。", eventLink: "来源链接", eventDate: "发生日期", eventTitle: "事件标题", eventExcerpt: "简短说明", eventReason: "为什么交来", eventSend: "交来这一天", eventSent: "已经收到，正在等待审核。",
    vimeo: "观看影像", vimeoOpen: "在 Vimeo 中打开", mediaTitle: "影像入口", mediaIntro: "", vimeoLabel: "Vimeo 影像", zhihuLabel: "知乎视频备用入口", bilibiliLabel: "Bilibili 视频入口", mediaLoading: "影像正在靠近…", mediaUnavailable: "影像此刻没有接住。", mediaFallback: "可以改从外部入口打开；如果仍不可达，文字档案仍然可以继续。", mediaRetry: "再试一次", mediaOpen: "打开外部入口", mediaFileUnavailable: "这份媒体暂时无法加载。",
    periodSoundTitle: "声音也在这里", periodSoundNote: "声音从原始页面进入；开放授权的声音可以直接播放或下载。", periodSoundOpen: "穿梭", periodSoundPlay: "播放声音", periodSoundContinue: "换日期时，声音仍留在水面上", periodSoundDownload: "下载声音", periodSoundLicense: "授权", periodSoundEmpty: "这一天暂时没有收进来的声音来源。", riverTitle: "名字沿着水面经过", riverHeading: "收录者的昵称，流过这一页", riverNote: "它在日期文章之后、随机遇见之前经过；这里流过档案中已有的作者与昵称。", timeObjectLabel: "时间不只向前", timeObjectNote: "让一周在不同的速度里同时发生。", hourglassLabel: "沙漏", clockLabel: "一刻钟", cinemaEnter: "进入影院", cinemaLeave: "离开影院", timeGestureDate: "日期被翻开了", timeGestureEncounter: "一条痕迹正在靠近", timeGestureRead: "它被你接住了", timeGestureSound: "声音把时间拉开", timeGestureOffer: "一份材料正在留下", timeGestureRestore: "足迹正在回来", timeGestureLanguage: "另一种语言靠近了", timeGestureExport: "公开资料被带走了", participantExportTitle: "参与者资料的公开副本", participantExportIntro: "任何人都可以带走一份当前已公开、已审核的参与资料；私人审核内容、阅读凭证、阅读进度和原始上传文件不会进入这里。", participantExportButton: "导出公开资料", participantExporting: "正在整理…", participantExported: "公开资料已经下载。", personalExportTitle: "我的足迹与见证", personalExportIntro: "下载这台设备上的阅读足迹，以及用这枚阅读凭证关联到的见证。不会包含别人的资料、阅读凭证本身或私密媒体原文件。", personalExportButton: "下载我的足迹与见证", personalExporting: "正在取回…", personalExported: "你的足迹与见证已经下载。", personalExportEmpty: "这里还没有找到你留下的见证。", materialsTitle: "项目材料", materialsIntro: "项目结构、变化与网站参考。", materialsArchitecture: "下载架构说明", materialsChangelog: "下载更新日志", materialsArtDirection: "下载网站美术参考", materialsSource: "下载项目材料包", materialsSourceNote: "",
    countryTitle: "原住民土地致意", countryText: "本网站于 Gadigal Country 上建构。我们向 Gadigal 人及澳大利亚各地的 Aboriginal and Torres Strait Islander peoples 致意，尊重他们与 Country 的持续联系，并向过去与现在的长者致敬。", countryLinkText: "官方参考", countryFlagAlt: "澳大利亚原住民旗帜与托雷斯海峡岛民旗帜的色彩标记", countryLocalTitle: "此项目 · Gadigal / Eora Nation", countryLocalText: "本网站于 Gadigal Country 上建构。", countryOtherTitle: "当地语境", countryOtherText: "请按阅读发生地，了解当地的 Traditional Owners 与 Country。", countryWiderTitle: "更广的致意 · Aboriginal and Torres Strait Islander peoples", countryWiderText: "向所有 Aboriginal and Torres Strait Islander peoples 与长者致意。", passportPromptTitle: "先留下一枚凭证。", passportPromptAcknowledge: "我已经记下了", receivedTitle: "已经被接住。", submissionPassTitle: "你的记录存档码已与这条见证绑定。", submissionPassNote: "请复制并妥善保存它；以后可在“友情链接 → 我的足迹与见证”导出自己的记录，或在新设备上取回足迹。", submissionPassExport: "现在导出我的足迹与见证", adminEntry: "编辑 / 审核", dialogClose: "关闭",
    mediaOffer: "留下声音或照片", mediaOfferIntro: "一张照片，或一段不超过30秒的声音。它会先被私密审核，接住以后才会出现在这里。", mediaFile: "照片或声音", mediaFileRequired: "请先选择一张照片或一段声音。", mediaFileNote: "（必填 · 单个文件）", mediaDate: "发生日期", mediaCaption: "想留下的说明", mediaName: "署名（选填）", mediaConsent: "我拥有这份媒体的分享权；我理解它不会自动公开，审核通过后才可能被后来的人遇见。", mediaSend: "把它交来", mediaSending: "正在接住文件…", mediaSent: "文件已经收到，正在等待被接住。", mediaPublic: "被接住的照片和声音会出现在近来的见证里；没有通过审核的文件不会公开。", mediaChoose: "选择一个文件", mediaPreview: "提交前先预览；声音不超过30秒，文件不超过1 MB。", mediaPhotoSpec: "照片 · JPG / PNG / WebP · 压缩至900 KB以内", mediaAudioSpec: "声音 · MP3 / M4A / OGG / WebM / WAV · 30秒以内、1 MB以内", mediaChange: "换一个文件", mediaPickerNote: "先选择一个文件；下方会出现预览。", mediaAudioPreview: "声音 · 提交前可试听", mediaPhotoPreview: "照片 · 提交前可查看",
    headingLead: "慢一点，", headingEmphasis: "遇见", headingTail: "一条痕迹。", footerLeft: "300条痕迹", footerRight: "阅读是一种接住。",
  },
  en: {
    archive: "300 traces", startup: "The archive is approaching…", device: "Held in the cloud", qr: "On-site QR", qrTitle: "Let it be encountered here", qrIntro: "Scan with your phone camera to return to this reading entrance.", qrDownload: "Download QR code", qrPreparing: "Leaving an entrance…",
    eyebrow: "An archive made to be encountered", footprint: "Your reading traces", met: "Already met", held: "of the archive has been received by you", cloud: "Trace status", cloudLocal: "Your traces remain on this device", cloudSyncing: "Your traces are approaching the cloud", cloudSynced: "A quiet copy of your traces is held in the cloud", cloudWaiting: "Your traces are safe on this device and will try to sync later", next: "The next approach", all: "All traces", status: "A living archive · open to additions", open: "Traverse", read: "Mark as read", readAlready: "Already read", draw: "Meet an unread trace", note: "An unread trace is offered first, whenever possible.", footer: "Reading is a way of receiving.", offer: "Offer a reference", passport: "Recover / keep a reading pass", original: "Chinese original", translationNote: "The original remains; this browser cannot make an English rendering yet.", translateLoading: "Approaching English…", source: "A new reference", labelIdea: "Idea", labelArticle: "Article", labelAnswer: "Answer", labelImage: "Image", labelEvent: "Event", labelAudio: "Sound", labelFilm: "Moving image", labelLink: "Passage", progressScope: "The total includes archive texts, dated images, events, sound, moving image and passages; encountering is not the same as reading.",
    submitTitle: "Offer a reference", submitIntro: "Only the link is needed; the other details are optional.", link: "Article link", date: "Publication date", title: "Title", excerpt: "Short excerpt", reason: "Why offer it here?", consent: "I understand: this is private for review and will not be published automatically.", send: "Offer it", close: "Close for now", sending: "Placing it…", sent: "Received. It is waiting to be held.", queued: "The entrance is quiet for now; this is saved on this device and will be offered again later.", passportTitle: "A reading pass", passportIntro: "Keep this pass. You can use it to recover your traces after clearing browser data or changing devices.", restore: "Recover traces", copy: "Copy", copied: "Copied", restoreLabel: "Enter your saved reading pass", restoreButton: "Bring traces back", restored: "Your traces have returned.", error: "It could not be held just now. Please try again.", imageAlt: "A trace behind the page", audio: "Receive sound", silence: "Return to quiet",
    community: "Newly received", communityIntro: "Received pieces appear here.", linksTitle: "Further encounters", linksIntro: "Personal works and community creations.", linksWork: "Esther's Morning Prayer · Personal works", linksCommunity: "Community creations", linksOpen: "Traverse", linksEmpty: "Links are still waiting to be placed here.", guestbook: "Leave a few words", guestbookIntro: "No name is needed. Once held in review, they may meet someone arriving later.", guestbookMessage: "What would you like to leave?", guestbookName: "Name (optional)", guestbookAnonymous: "Anonymous", guestbookSend: "Leave these words", guestbookSending: "Leaving them…", guestbookSent: "Your words have arrived and are waiting to be held.", guestbookEmpty: "No words have been left here yet.",
    periodTitle: "Time layer · 16–22 March 2026", periodHeading: "Return to that week", periodIntro: "", periodCount: "traces", periodEmpty: "Nothing from this day is ready to show yet.", periodImageTitle: "Images in rotation", periodImageNote: "A rotation by date.", periodImageRandom: "Meet another image", periodImageOpen: "Traverse", periodImageCredit: "Source / note", periodImageEmpty: "No image has been received into this day.", periodImageSeen: "already encountered",
    periodEventsTitle: "Also happening on this day", periodEventsNote: "News, public calendars, astronomy and ecological signals sit beside one another; this is not a complete news digest.", periodEventEmpty: "Nothing has been received into this day’s event layer yet.", periodEventOpen: "Traverse", eventOffer: "Offer an event from this day", eventOfferIntro: "Leave the date and source link; the other fields can stay empty. Once reviewed, it will enter this day.", eventLink: "Source link", eventDate: "Date of event", eventTitle: "Event title", eventExcerpt: "Short note", eventReason: "Why offer it?", eventSend: "Offer this day", eventSent: "Received. It is waiting for review.",
    vimeo: "Watch the film", vimeoOpen: "Open on Vimeo", mediaTitle: "Moving-image entrance", mediaIntro: "", vimeoLabel: "Vimeo film", zhihuLabel: "Zhihu video fallback", bilibiliLabel: "Bilibili video", mediaLoading: "The film is approaching…", mediaUnavailable: "The film could not be held just now.", mediaFallback: "Try the external entrance; if it remains unreachable, the text archive can continue.", mediaRetry: "Try again", mediaOpen: "Open external entrance", mediaFileUnavailable: "This media could not be loaded just now.",
    periodSoundTitle: "Sound is here too", periodSoundNote: "Sound enters from its source; openly licensed pieces can be played or downloaded.", periodSoundOpen: "Traverse", periodSoundPlay: "Play sound", periodSoundContinue: "When the date changes, the sound stays on the water", periodSoundDownload: "Download audio", periodSoundLicense: "Licence", periodSoundEmpty: "No sound source has been received into this day yet.", riverTitle: "Names passing over water", riverHeading: "The names of those collected, flowing through this page", riverNote: "It passes after the dated articles and before the random encounter; these are the archive’s existing authors and nicknames.", timeObjectLabel: "Time does not only move forward", timeObjectNote: "Let the week happen at several speeds at once.", hourglassLabel: "Hourglass", clockLabel: "A held hour", cinemaEnter: "Enter cinema", cinemaLeave: "Leave cinema", timeGestureDate: "The date has opened", timeGestureEncounter: "A trace is approaching", timeGestureRead: "It has been received", timeGestureSound: "Sound has opened time", timeGestureOffer: "A piece is being left", timeGestureRestore: "Your traces are returning", timeGestureLanguage: "Another language is arriving", timeGestureExport: "The public record has been carried away", participantExportTitle: "A public copy of participant materials", participantExportIntro: "Anyone may carry away the participation materials currently public and reviewed. Private review records, reading passes, reading progress and original uploads are not included.", participantExportButton: "Export public materials", participantExporting: "Gathering the materials…", participantExported: "The public materials have been downloaded.", personalExportTitle: "My traces and witnesses", personalExportIntro: "Download this device’s reading traces and the witnesses linked to this reading pass. It does not include anyone else’s records, the pass itself or private media files.", personalExportButton: "Download my traces and witnesses", personalExporting: "Recovering them…", personalExported: "Your traces and witnesses have been downloaded.", personalExportEmpty: "No witness has been linked to this pass yet.", materialsTitle: "Project materials", materialsIntro: "The project’s structure, changes and selected references for artist websites are kept here. The materials do not include the review key, reading passes, private review records or original uploads.", materialsArchitecture: "Download architecture", materialsChangelog: "Download changelog", materialsArtDirection: "Download art-direction references", materialsSource: "Download project materials", materialsSourceNote: "",
    countryTitle: "Acknowledgement of Country", countryText: "This website was built on Gadigal Country. We acknowledge the Gadigal people and Aboriginal and Torres Strait Islander peoples across Australia, their continuing connections to Country, and Elders past and present.", countryLinkText: "Official reference", countryFlagAlt: "Australian Aboriginal and Torres Strait Islander Flag colours", countryLocalTitle: "This project · Gadigal / Eora Nation", countryLocalText: "This website was built on Gadigal Country.", countryOtherTitle: "Local context", countryOtherText: "Learn the Traditional Owners and Country where the archive is being read.", countryWiderTitle: "Wider acknowledgement · Aboriginal and Torres Strait Islander peoples", countryWiderText: "Respect to Aboriginal and Torres Strait Islander peoples and Elders.", passportPromptTitle: "Keep a small pass.", passportPromptAcknowledge: "I have kept it", receivedTitle: "It has been received.", submissionPassTitle: "Your record archive code is now linked to this witness.", submissionPassNote: "Copy and keep it. Later, use “Related links → My traces and witnesses” to export your own record, or recover your traces on another device.", submissionPassExport: "Export my traces and witnesses now", adminEntry: "Edit / review", dialogClose: "Close",
    mediaOffer: "Leave a sound or photograph", mediaOfferIntro: "One photograph, or a sound of no more than 30 seconds. It stays private for review before it can appear here.", mediaFile: "Photograph or sound", mediaFileRequired: "Please choose a photograph or sound first.", mediaFileNote: "(required · one file)", mediaDate: "Date of the moment", mediaCaption: "A note for the moment", mediaName: "Name (optional)", mediaConsent: "I have the right to share this media. I understand it will not be public automatically, and may only be encountered after review.", mediaSend: "Offer it", mediaSending: "Receiving the file…", mediaSent: "The file has arrived and is waiting to be held.", mediaPublic: "Received photographs and sounds may appear among recent witnesses; unreviewed files stay private.", mediaChoose: "Choose one file", mediaPreview: "Preview before offering; sound stays under 30 seconds and 1 MB.", mediaPhotoSpec: "Photograph · JPG / PNG / WebP · compressed under 900 KB", mediaAudioSpec: "Sound · MP3 / M4A / OGG / WebM / WAV · up to 30 seconds, 1 MB", mediaChange: "Choose another file", mediaPickerNote: "Choose one file first; a preview will appear below.", mediaAudioPreview: "Sound · listen before offering", mediaPhotoPreview: "Photograph · view before offering",
    headingLead: "Slow down. ", headingEmphasis: "Meet", headingTail: " a trace.", footerLeft: "300 traces", footerRight: "Reading is a way of receiving.",
  },
};

export function defaultPageCopy(locale: CopyLocale, total: number): Record<string, string> {
  const waiting = Math.max(0, 300 - total);
  const copy = { ...defaults[locale] };
  Object.assign(copy, locale === "zh" ? {
    participationIntro: "",
    secondaryTitle: "友情链接",
    secondaryIntro: "",
    secondaryOpen: "打开友情链接",
    secondaryClose: "收起友情链接",
    materialsSourceNote: "",
    mediaIntro: "",
    periodIntro: "",
    periodImageNote: "按日期轮动。",
    periodEventsNote: "新闻、日历、天文与生态信号。",
    periodSoundNote: "从原始页面进入；开放授权的声音可播放或下载。",
    periodSoundContinue: "声音留在水面上。",
    riverNote: "作者与昵称从这里经过。",
    linksIntro: "个人作品与社区创作。",
    linksWork: "以斯帖的晨祷 · 个人作品",
    linksCommunity: "社区创作",
    community: "留言区",
    communityIntro: "留言和参与者交来的参考，会在这里出现。",
    communityEmpty: "还没有新的见证。",
    progressScope: "文章、图片、事件、声音、影像与入口，都在这里留下足迹。",
  } : {
    participationIntro: "",
    secondaryTitle: "Related links",
    secondaryIntro: "",
    secondaryOpen: "Open related links",
    secondaryClose: "Close related links",
    materialsSourceNote: "",
    mediaIntro: "",
    periodIntro: "",
    periodImageNote: "A rotation by date.",
    periodEventsNote: "News, calendars, astronomy and ecological signals.",
    periodSoundNote: "From the source page; openly licensed pieces may be played or downloaded.",
    periodSoundContinue: "Sound stays on the water.",
    riverNote: "Authors and names pass through here.",
    linksIntro: "Personal works and community creations.",
    linksWork: "Esther's Morning Prayer · Personal works",
    linksCommunity: "Community creations",
    community: "Guestbook",
    communityIntro: "Messages and participant references appear here.",
    communityEmpty: "No new witness has arrived yet.",
    progressScope: "Texts, images, events, sound, film and passages all leave a trace here.",
  });
  for (const key of ["participationMedia", "participationMediaNote", "mediaOffer", "mediaOfferIntro", "mediaFile", "mediaFileRequired", "mediaFileNote", "mediaDate", "mediaCaption", "mediaName", "mediaConsent", "mediaSend", "mediaSending", "mediaSent", "mediaPublic", "mediaChoose", "mediaPreview", "mediaPhotoSpec", "mediaAudioSpec", "mediaChange", "mediaPickerNote", "mediaAudioPreview", "mediaPhotoPreview", "mediaFileUnavailable", "participationEvent", "participationEventNote", "participationGuestbook", "participationGuestbookNote", "guestbook", "guestbookIntro", "guestbookMessage", "guestbookName", "guestbookAnonymous", "guestbookSend", "guestbookSending", "guestbookSent", "guestbookEmpty", "eventOffer", "eventOfferIntro", "eventLink", "eventDate", "eventTitle", "eventExcerpt", "eventReason", "eventSend", "eventSent"]) delete copy[key];
  copy.offer = locale === "zh" ? "反馈" : "Feedback";
  copy.participationIntro = "";
  copy.linksRelated = locale === "zh" ? "活动链接" : "Activity links";
  copy.linksRelatedCommunity = locale === "zh" ? "相关整理" : "Related list";
  copy.personalExportIntro = locale === "zh" ? "下载你遇见过的文章、图片、事件、声音、影像与入口链接，以及用这枚阅读凭证关联到的见证。" : "Download the links to articles, images, events, sound, moving image and passages you encountered, together with witnesses linked to this reading pass.";
  copy.date = locale === "zh" ? "相关日期" : "Related date";
  copy.intro = locale === "zh"
    ? (waiting ? `这里已有 ${total} 个被留下的片段；还有 ${waiting} 个位置，仍在等待被接住。你可以随机遇见，也可以沿着某一种形式靠近它们。` : `这里有 ${total} 个被留下的片段。你可以随机遇见，也可以沿着某一种形式靠近它们。`)
    : (waiting ? `${total} fragments have been left here; ${waiting} places are still waiting to be received. Encounter one at random, or move closer through a chosen form.` : `There are ${total} fragments left here. Encounter one at random, or move closer through a chosen form.`);
  for (const key of ["submitIntro", "consent", "sent", "guestbookIntro", "mediaOfferIntro", "mediaConsent", "mediaPublic", "participantExportIntro", "personalExportIntro", "materialsIntro", "materialsSourceNote"]) {
    if (!copy[key]) continue;
    copy[key] = copy[key]
      .replace(/私密审核/g, "审核")
      .replace(/私密/g, "")
      .replace(/private review/gi, "review")
      .replace(/private media files/gi, "media files")
      .replace(/private review records/gi, "review records")
      .replace(/stay private/gi, "stay unpublished")
      .replace(/is private for review/gi, "is for review");
  }
  copy.participantExportIntro = locale === "zh" ? "任何人都可以带走一份当前公开的参与资料；阅读凭证、阅读进度和原始上传文件不会进入这里。" : "Anyone may carry away the participation materials currently public; reading passes, reading progress and original uploads are not included.";
  copy.materialsIntro = locale === "zh" ? "一份可直接复用的项目结构、数据格式与网站参考。" : "A reusable project structure, data format and selected website references.";
  Object.assign(copy, readerSurfaceCopy(locale, total));
  return {
    ...copy,
    exportTitle: locale === "zh" ? "资料与足迹，带走一份" : "Materials and traces, carried away",
    exportIntro: "",
    materialsData: locale === "zh" ? "下载完整档案数据" : "Download complete archive data",
  };
}
