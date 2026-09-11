"use client";

import { FormEvent, useEffect, useState } from "react";

type Locale = "zh" | "en";
type InstructionEntry = { id: string; instruction: string; instructionEn?: string; createdAt: string; fixed?: boolean };

const STORAGE_KEY = "300-traces-instruction-library-v1";
const SEED_ENTRIES: InstructionEntry[] = [
  { id: "zhihu-march-week-mention", instruction: "在知乎 @ 一位和你的 3 月 16 日—3 月 22 日有关的人。", instructionEn: "On Zhihu, @-mention someone connected to your 16–22 March.", createdAt: "2026-03-16T00:00:00.000Z", fixed: true },
];
const copy = {
  zh: {
    title: "指令库", eyebrow: "留存的指令", intro: "把想再次使用的指令留在这里。", instruction: "指令", instructionPlaceholder: "写下要保留的指令…", add: "加入指令库", remove: "移除", empty: "这里还没有指令。", saved: "已经保存到这台设备。", back: "回到阅读档案", toggle: "EN", fixed: "固定指令"
  },
  en: {
    title: "Instruction library", eyebrow: "Saved instructions", intro: "Keep instructions you may return to here.", instruction: "Instruction", instructionPlaceholder: "Write an instruction to keep…", add: "Add to library", remove: "Remove", empty: "No instructions here yet.", saved: "Saved on this device.", back: "Return to the archive", toggle: "中文", fixed: "Fixed instruction"
  }
} as const;

function validEntries(): InstructionEntry[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is InstructionEntry => Boolean(item && typeof item.id === "string" && typeof item.instruction === "string" && typeof item.createdAt === "string" && !item.fixed)) : [];
  } catch {
    return [];
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveEntries(entries: InstructionEntry[]) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* keep the current page usable if storage is unavailable */ }
}

export function InstructionLibrary() {
  const [locale, setLocale] = useState<Locale>("en");
  const [entries, setEntries] = useState<InstructionEntry[]>([]);
  const [instruction, setInstruction] = useState("");
  const [saved, setSaved] = useState(false);
  const text = copy[locale];

  useEffect(() => {
    setLocale(window.localStorage.getItem("trace-archive-locale-v1") === "zh" ? "zh" : "en");
    const stored = validEntries();
    setEntries([...SEED_ENTRIES, ...stored]);
  }, []);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = instruction.trim();
    if (!value) return;
    const next = [...entries, { id: newId(), instruction: value, createdAt: new Date().toISOString() }];
    setEntries(next);
    saveEntries(next);
    setInstruction("");
    setSaved(true);
  }

  function remove(id: string) {
    if (SEED_ENTRIES.some((entry) => entry.id === id)) return;
    const next = entries.filter((entry) => entry.id !== id);
    setEntries(next);
    saveEntries(next);
  }

  function toggleLocale() {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
    try { window.localStorage.setItem("trace-archive-locale-v1", next); } catch { /* the page can still switch language */ }
  }

  return <main className="instruction-library-shell">
    <header className="instruction-library-header"><a className="wordmark" href="/" aria-label={text.back}><span className="wordmark-mark" aria-hidden="true">◌</span><span>300 traces</span></a><nav aria-label="Page tools"><a className="instruction-library-back" href="/">{text.back}</a><button className="language-switch" type="button" onClick={toggleLocale}>{text.toggle}</button></nav></header>
    <section className="instruction-library-intro"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.intro}</p></section>
    <form className="instruction-library-form" onSubmit={add}><label>{text.instruction}<textarea required value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={text.instructionPlaceholder} /></label><div className="instruction-library-form-actions"><button className="open-button" type="submit">{text.add}</button>{saved && <span className="instruction-library-feedback" role="status" aria-live="polite">{text.saved}</span>}</div></form>
    <section className="instruction-library-list" aria-live="polite">{entries.length ? entries.map((entry) => <article className={entry.fixed ? "instruction-card is-fixed" : "instruction-card"} key={entry.id}><div className="instruction-card-meta"><span>{entry.fixed ? text.fixed : new Date(entry.createdAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-AU")}</span></div><p>{locale === "en" ? entry.instructionEn || entry.instruction : entry.instruction}</p><div className="instruction-card-actions">{!entry.fixed && <button type="button" onClick={() => remove(entry.id)}>{text.remove}</button>}</div></article>) : <p className="instruction-library-empty">{text.empty}</p>}</section>
  </main>;
}
