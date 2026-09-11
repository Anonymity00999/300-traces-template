export function safeExternalVideoUrl(value: unknown, host: RegExp) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && host.test(parsed.hostname) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function safeVimeoUrl(value: unknown) {
  return safeExternalVideoUrl(value, /(^|\.)vimeo\.com$/i);
}

export function safeZhihuVideoUrl(value: unknown) {
  const url = safeExternalVideoUrl(value, /(^|\.)zhihu\.com$/i);
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    return /\/(?:video|zvideo)(?:\/|$)/i.test(pathname) ? url : "";
  } catch {
    return "";
  }
}

export function safeBilibiliVideoUrl(value: unknown) {
  const url = safeExternalVideoUrl(value, /(^|\.)bilibili\.com$|(^|\.)b23\.tv$/i);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (/(^|\.)bilibili\.com$/i.test(parsed.hostname)) return /^\/video\//i.test(parsed.pathname) ? url : "";
    return url;
  } catch {
    return "";
  }
}

export function vimeoEmbedUrl(value: string) {
  try {
    const id = new URL(value).pathname.match(/\/(\d+)(?:\/|$)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0&api=1&player_id=archive-vimeo` : "";
  } catch {
    return "";
  }
}
