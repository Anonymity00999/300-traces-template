/** Personal archive v3: identity, browsing, opening dates, and authored witnesses only. */
export type OpeningTimes = Record<string, { firstOpenedAt: string; lastOpenedAt: string }>;
const validId = (value: unknown): value is string => typeof value === "string" && /^[\w-]{1,100}$/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
export function cleanIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter(validId))].slice(0, 2000) : [];
}
export function cleanOpeningTimes(value: unknown): OpeningTimes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: OpeningTimes = {};
  for (const [id, times] of Object.entries(value).slice(0, 2000)) {
    if (!validId(id) || !times || typeof times !== "object") continue;
    const { firstOpenedAt, lastOpenedAt } = times as Record<string, unknown>;
    if (typeof firstOpenedAt !== "string" || typeof lastOpenedAt !== "string") continue;
    const first = Date.parse(firstOpenedAt), last = Date.parse(lastOpenedAt);
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last || last > Date.now() + 300000) continue;
    result[id] = { firstOpenedAt: new Date(first).toISOString(), lastOpenedAt: new Date(last).toISOString() };
  }
  return result;
}
export function mergeOpeningTimes(...inputs: unknown[]): OpeningTimes {
  const result: OpeningTimes = {};
  for (const input of inputs) for (const [id, times] of Object.entries(cleanOpeningTimes(input))) {
    const old = result[id];
    result[id] = old ? {
      firstOpenedAt: old.firstOpenedAt < times.firstOpenedAt ? old.firstOpenedAt : times.firstOpenedAt,
      lastOpenedAt: old.lastOpenedAt > times.lastOpenedAt ? old.lastOpenedAt : times.lastOpenedAt,
    } : times;
  }
  return cleanOpeningTimes(result);
}
export function recordOpening(times: OpeningTimes, id: string, now = new Date().toISOString()): OpeningTimes {
  return mergeOpeningTimes(times, { [id]: { firstOpenedAt: now, lastOpenedAt: now } });
}
export function safeWitness(value: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of ["id", "createdAt", "url", "title", "excerpt", "reason", "message", "name", "publishedAt", "date", "caption", "type", "kind"]) {
    if (typeof value[key] === "string" && value[key]) result[key] = value[key] as string;
  }
  return result;
}
export function ownLocalWitnesses(history: unknown[], userCode: string) {
  return history.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .filter((item) => item.userCode === userCode && item.recordKind !== "feedback" && item.record && typeof item.record === "object")
    .map((item) => safeWitness({ ...(item.record as object), id: item.id, createdAt: item.createdAt }));
}
export function personalExport(userCode: string, materials: Record<string, unknown>[], readingTime: OpeningTimes, witnesses: Record<string, unknown>[]) {
  return {
    userCode,
    browsingData: materials.map((item) => Object.fromEntries(
      ["id", "kind", "type", "titleZh", "titleEn", "sourceUrl", "imageUrl", "playbackUrl", "downloadUrl", "vimeoUrl", "bilibiliVideoUrl"]
        .filter((key) => typeof item[key] === "string" && item[key]).map((key) => [key, item[key]])
    )),
    readingTime: cleanOpeningTimes(readingTime),
    witnesses: witnesses.map(safeWitness),
  };
}
