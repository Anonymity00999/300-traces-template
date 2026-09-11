export const ARCHIVE_CONFIG = {
  schemaVersion: 1,
  targetCount: 300,
  period: {
    from: "2026-03-16",
    to: "2026-03-22",
    dates: [
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
      "2026-03-20",
      "2026-03-21",
      "2026-03-22",
    ],
  },
  types: ["idea", "article", "answer"] as const,
} as const;

export type ArchiveRecordKind = "witness";
