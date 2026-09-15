"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SCRATCH_FILMS, SCRATCH_FILMS_ENABLED, type ScratchFilm } from "./data/scratch-films";
import "./scratch-film.css";
import { safeBilibiliVideoUrl } from "./media";

const WIDTH = 720;
const HEIGHT = 400;
const THRESHOLD = 0.42;
type Point = { x: number; y: number };

function usableUrl(raw: string) {
  return safeBilibiliVideoUrl(raw);
}

export function ScratchFilmEntrance({ locale, revealedFilm, ready, onReveal }: { locale: "zh" | "en"; revealedFilm?: ScratchFilm; ready: boolean; onReveal: (id: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const revealedButton = useRef<HTMLButtonElement>(null);
  const zh = locale === "zh";
  if (!SCRATCH_FILMS_ENABLED || SCRATCH_FILMS.length !== 2) return null;
  return <section id="scratch-films" className="scratch-film" aria-labelledby="scratch-film-title">
    <div className="scratch-film-heading">
      <h2 id="scratch-film-title">{zh ? "感到疲惫？来敲彩蛋！" : "Feeling tired? Crack open a surprise!"}</h2>
    </div>
    {revealedFilm ? <div className="scratch-film-stage is-revealed"><RevealedFilm film={revealedFilm} zh={zh} buttonRef={revealedButton} /></div> : selected === null ? <div className="scratch-film-choices" aria-busy={!ready}>
      {SCRATCH_FILMS.map((film, i) => <button type="button" className="scratch-film-choice" key={film.id}
        disabled={!ready} onClick={() => setSelected(i)} aria-label={zh ? film.titleZh : film.titleEn}>
        <span className="scratch-film-choice-number" aria-hidden="true">0{i + 1}</span>
        <span className="scratch-film-choice-title">{zh ? film.titleZh : film.titleEn}</span>
      </button>)}
    </div> : <ScratchSurface key={SCRATCH_FILMS[selected].id} film={SCRATCH_FILMS[selected]} locale={locale} onBack={() => setSelected(null)} onReveal={() => onReveal(SCRATCH_FILMS[selected].id)} />}
  </section>;
}

function ScratchSurface({ film, locale, onBack, onReveal }: { film: ScratchFilm; locale: "zh" | "en"; onBack: () => void; onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sampler = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef<{ id: number; point: Point } | null>(null);
  const keyboard = useRef<Point>({ x: WIDTH / 2, y: HEIGHT / 2 });
  const opened = useRef(false);
  const lastSample = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [armed, setArmed] = useState(false);
  const [noCanvas, setNoCanvas] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [keyboardCursor, setKeyboardCursor] = useState<Point | null>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const zh = locale === "zh";

  const reveal = () => {
    if (opened.current) return;
    opened.current = true;
    pointer.current = null;
    setRevealed(true);
    onReveal();
  };

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) { setNoCanvas(true); return; }
    const wax = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    wax.addColorStop(0, "#6d858a");
    wax.addColorStop(.55, "#a4aaa1");
    wax.addColorStop(1, "#c2b39a");
    ctx.fillStyle = wax;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Fixed local grain, no remote textures and no animation loop.
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff0a" : "#223b4010";
      ctx.fillRect((i * 137.3) % WIDTH, (i * 79.7) % HEIGHT, 1, 2);
    }
    const sample = document.createElement("canvas");
    sample.width = 72;
    sample.height = 40;
    sampler.current = sample;
    return () => { pointer.current = null; sampler.current = null; };
  }, []);

  useEffect(() => { if (revealed) revealButton.current?.focus({ preventScroll: true }); }, [revealed]);

  const measure = (force = false) => {
    if (!force && performance.now() - lastSample.current < 100) return;
    lastSample.current = performance.now();
    const ctx = sampler.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !canvas.current) return;
    ctx.clearRect(0, 0, 72, 40);
    ctx.drawImage(canvas.current, 0, 0, 72, 40);
    const pixels = ctx.getImageData(0, 0, 72, 40).data;
    let clear = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 100) clear++;
    const amount = clear / (72 * 40);
    setCoverage(Math.min(1, amount / THRESHOLD));
    if (amount >= THRESHOLD) reveal();
  };

  const scratch = (from: Point, to: Point) => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || opened.current || Math.hypot(to.x - from.x, to.y - from.y) < 1) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = 52;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    measure();
  };

  const point = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(WIDTH, (event.clientX - rect.left) * WIDTH / rect.width)),
      y: Math.max(0, Math.min(HEIGHT, (event.clientY - rect.top) * HEIGHT / rect.height)) };
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!armed || !event.isPrimary || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, point: point(event) };
    setKeyboardCursor(null);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    const next = point(event); scratch(current.point, next); current.point = next;
  };
  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    measure(true);
  };
  const key = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === "Escape") { setArmed(false); pointer.current = null; return; }
    const directions: Record<string, Point> = { ArrowLeft: { x: -30, y: 0 }, ArrowRight: { x: 30, y: 0 }, ArrowUp: { x: 0, y: -30 }, ArrowDown: { x: 0, y: 30 } };
    const delta = directions[event.key];
    if (!armed || !delta) return;
    event.preventDefault();
    const next = { x: Math.max(0, Math.min(WIDTH, keyboard.current.x + delta.x)), y: Math.max(0, Math.min(HEIGHT, keyboard.current.y + delta.y)) };
    scratch(keyboard.current, next); keyboard.current = next; setKeyboardCursor(next);
  };

  return <div>
    <div className={`scratch-film-stage ${revealed ? "is-revealed" : ""}`}>
      <div className="scratch-film-glow" aria-hidden="true" />
      {revealed ? <RevealedFilm film={film} zh={zh} buttonRef={revealButton} /> : <>
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={armed ? 0 : -1} role="group"
          aria-label={zh ? "刮画表面" : "Scratch surface"} aria-describedby="scratch-film-help"
          className={armed ? "is-armed" : ""}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onLostPointerCapture={() => { pointer.current = null; }}
          onBlur={() => { pointer.current = null; }} onKeyDown={key} />
        {!armed && <button type="button" className="scratch-film-start" onClick={() => { setArmed(true); requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true })); }}>{zh ? "开始刮开" : "Begin rubbing"}</button>}
        {keyboardCursor && <span className="scratch-film-cursor" aria-hidden="true" style={{ left: `${keyboardCursor.x / WIDTH * 100}%`, top: `${keyboardCursor.y / HEIGHT * 100}%` }} />}
      </>}
    </div>
    {!revealed && <>
      <p id="scratch-film-help" className="scratch-film-help">{armed ? (zh ? "按住，来回刮；也可用方向键。" : "Press and rub back and forth, or use the arrow keys.") : (zh ? "一层薄蜡，等你触碰。" : "A thin layer of wax, waiting for your touch.")}</p>
      <p className="scratch-film-status" role="status">{coverage > .7 ? (zh ? "快要透光了。" : "Light is coming through.") : coverage > .25 ? (zh ? "痕迹正在显现。" : "Traces are appearing.") : ""}</p>
      <details className="scratch-film-access"><summary>{zh ? "另一种打开方式" : "Another way in"}</summary><button type="button" onClick={reveal}>{zh ? "轻触揭晓" : "Reveal with a tap"}</button></details>
      {noCanvas && <p>{zh ? "这个浏览器可用轻触揭晓。" : "Use the tap-to-reveal option in this browser."}</p>}
    </>}
    {!revealed && <div className="scratch-film-actions">
      {!revealed && armed && <button type="button" onClick={() => { setArmed(false); pointer.current = null; }}>{zh ? "暂时放下" : "Rest for a moment"}</button>}
      <button type="button" onClick={onBack}>{zh ? "回到两面" : "Return to both surfaces"}</button>
    </div>}
  </div>;
}

function RevealedFilm({ film, zh, buttonRef }: { film: ScratchFilm; zh: boolean; buttonRef: React.RefObject<HTMLButtonElement | null> }) {
  const url = usableUrl(film.url);
  return <div className="scratch-film-reveal">
    <p>{zh ? film.titleZh : film.titleEn}</p>
    {url ? <button type="button" ref={buttonRef} onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>{zh ? "穿梭 ↗" : "Traverse ↗"}</button>
      : <p role="status">{zh ? "哔哩哔哩影像即将抵达。" : "The film is coming to Bilibili."}</p>}
  </div>;
}
