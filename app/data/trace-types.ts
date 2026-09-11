import { TITLE_TRANSLATIONS } from "./title-translations";

export type TraceType = "idea" | "article" | "answer";

export type Trace = {
  id: number;
  sourceId: string;
  schemaVersion?: number;
  type: TraceType;
  title: string;
  excerpt: string;
  titleEn?: string;
  excerptEn?: string;
  sourceLabel: string;
  sourceUrl: string;
  author?: string;
  createdAt?: string;
  topics?: string[];
};

export const TYPE_LABELS: Record<TraceType, string> = {
  idea: "想法",
  article: "文章",
  answer: "回答",
};

type RawTrace = Omit<Trace, "type"> & { type: string };

function normaliseTraceType(value: string): TraceType {
  return value === "idea" || value === "answer" ? value : "article";
}

export function prepareTraceData(data: RawTrace[]): Trace[] {
  return data.map((trace) => ({ ...trace, type: normaliseTraceType(trace.type), titleEn: TITLE_TRANSLATIONS[trace.title] }));
}
