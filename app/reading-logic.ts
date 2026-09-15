import type { Trace } from "./data/trace-types";

export function traceId(trace: Trace) { return trace.sourceId || String(trace.id); }
export function traceIsRead(read: ReadonlySet<string>, trace: Trace) {
  return [traceId(trace), String(trace.id)].some(id => read.has(id) || read.has(`trace-${id}`));
}

/** A displayed card is not a read article. Use a separate, session-only seen set. */
export function traceCandidates(traces: readonly Trace[], filter: "all" | Trace["type"], read: ReadonlySet<string>, current: string, seen: ReadonlySet<string>) {
  const filtered=traces.filter(trace=>filter==="all" || trace.type===filter);
  const others=filtered.filter(trace=>traceId(trace)!==current);
  const available=others.length ? others : filtered;
  const unread=available.filter(trace=>!traceIsRead(read,trace));
  const pool=unread.length ? unread : available;
  const fresh=pool.filter(trace=>!seen.has(traceId(trace)));
  return fresh.length ? fresh : pool;
}

/**
 * Resolve a draw against the id currently on screen, rather than the id that
 * happened to be current when the click handler was created. This matters for
 * quick consecutive taps: React may batch those taps before the card rerenders.
 */
export function nextTraceId(candidates: readonly Trace[], current: string, random: () => number = Math.random) {
  return nextDistinctId(candidates, current, traceId, random) ?? current;
}

/** Pick a new item using the id actually visible when the state update lands. */
export function nextDistinctId<T>(entries: readonly T[], current: string | null, identify: (entry: T) => string, random: () => number = Math.random) {
  if (!entries.length) return null;
  const index = Math.min(entries.length - 1, Math.max(0, Math.floor(random() * entries.length)));
  const chosen = entries[index];
  if (identify(chosen) !== current) return identify(chosen);
  return identify(entries.find((entry) => identify(entry) !== current) ?? chosen);
}

function shuffled<T>(values: readonly T[], random: ()=>number) {
  const result=[...values];
  for (let i=result.length-1;i>0;i--) {
    const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}

/** Fill from unseen, then other previous cards, then the current group if needed. */
export function periodSelection(pool: readonly Trace[], seen: ReadonlySet<string>, current: readonly string[], random: ()=>number=Math.random) {
  const previous=new Set(current);
  const fresh=pool.filter(trace=>!seen.has(traceId(trace)) && !previous.has(traceId(trace)));
  const others=pool.filter(trace=>seen.has(traceId(trace)) && !previous.has(traceId(trace)));
  const remaining=pool.filter(trace=>previous.has(traceId(trace)));
  return [...shuffled(fresh,random),...shuffled(others,random),...shuffled(remaining,random)].slice(0,3);
}

export function hasTraceExcerpt(excerpt?: string) {
  const value=excerpt?.trim();
  return Boolean(value && !/^(想法|文章|回答|idea|article|answer)$/i.test(value));
}

export type TraceTranslation = { traceId: string; title: string; excerpt: string };
export function translationFor(trace: Trace, translation: TraceTranslation | null) {
  return translation?.traceId===traceId(trace) ? translation : null;
}
