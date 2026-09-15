export type RelatedLinkKind = "work" | "community";

export type RelatedLink = {
  id: string;
  kind: RelatedLinkKind;
  /** Links with the same activity ID render as one activity with supporting links beneath it. */
  activityId?: string;
  activityRole?: "activity" | "related";
  titleZh: string;
  titleEn: string;
  url: string;
  noteZh?: string;
  noteEn?: string;
  enabled?: boolean;
};

export const MANAGED_CONTENT_IDS = [
  "period",
  "encounter",
  "participation",
  "recent",
  "secondary",
] as const;

export type ManagedContentId = (typeof MANAGED_CONTENT_IDS)[number];

export const DEFAULT_CONTENT_ORDER: ManagedContentId[] = [...MANAGED_CONTENT_IDS];

export function normalizeContentOrder(value: unknown): ManagedContentId[] {
  const requested = Array.isArray(value) ? value : [];
  const hasLegacyIds = requested.some((item) => typeof item === "string" && ["links", "offer", "media-offer", "guestbook", "participant-export", "materials", "media", "recent-media"].includes(item));
  const known = requested.flatMap((item): ManagedContentId[] => {
    if (typeof item !== "string") return [];
    if ((MANAGED_CONTENT_IDS as readonly string[]).includes(item)) return [item as ManagedContentId];
    if (["links", "participant-export", "materials", "media"].includes(item)) return ["secondary"];
    if (item === "recent-media") return ["recent"];
    if (["offer", "media-offer", "guestbook"].includes(item)) return ["participation"];
    return [];
  });
  if (hasLegacyIds) {
    const migrated = new Set(known);
    return [...DEFAULT_CONTENT_ORDER.filter((id) => migrated.has(id)), ...DEFAULT_CONTENT_ORDER.filter((id) => !migrated.has(id))];
  }
  return [...new Set([...known, ...DEFAULT_CONTENT_ORDER])];
}

export function normalizeRelatedLinks(value: unknown): RelatedLink[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 40).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(source.id) ? source.id : `link-${index + 1}`;
    // Retired by the owner; also exclude it when old cloud settings are read.
    if (id === "zhihu-village-history-community") return [];
    if (seen.has(id)) return [];
    const url = typeof source.url === "string" ? source.url.trim() : "";
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
    } catch { return []; }
    const titleZh = typeof source.titleZh === "string" ? source.titleZh.trim().slice(0, 160) : "";
    const titleEn = typeof source.titleEn === "string" ? source.titleEn.trim().slice(0, 160) : "";
    const activityId = typeof source.activityId === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(source.activityId) ? source.activityId : "";
    const omitNote = id === "zhihu-moliere-viewing" || id === "zhihu-fruit-world";
    if (!titleZh && !titleEn) return [];
    seen.add(id);
    return [{
      id,
      kind: source.kind === "community" ? "community" : "work",
      ...(activityId ? { activityId } : {}),
      ...(activityId && source.activityRole === "related" ? { activityRole: "related" as const } : activityId && source.activityRole === "activity" ? { activityRole: "activity" as const } : {}),
      titleZh: titleZh || titleEn,
      titleEn: titleEn || titleZh,
      url,
      ...(!omitNote && typeof source.noteZh === "string" && source.noteZh.trim() ? { noteZh: source.noteZh.trim().slice(0, 240) } : {}),
      ...(!omitNote && typeof source.noteEn === "string" && source.noteEn.trim() ? { noteEn: source.noteEn.trim().slice(0, 240) } : {}),
      enabled: source.enabled !== false,
    } satisfies RelatedLink];
  });
}
