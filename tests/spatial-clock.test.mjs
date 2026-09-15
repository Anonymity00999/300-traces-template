import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { spatialClockFrame, startupClockFrame, projectClockPoint, clockSurfacePath, clockViewportFit, scentFrame } from "../app/spatial-clock.ts";

test("the imagined clock remains finite over long sessions and invalid inputs", () => {
  for (const t of [0, 1, 60, 3600, 86400, 1e7, NaN, Infinity, -10]) {
    for (const value of Object.values(spatialClockFrame(t))) assert.ok(Number.isFinite(value));
  }
  assert.deepEqual(spatialClockFrame(NaN), spatialClockFrame(0));
});

test("hands change pace and briefly turn back without stalling", () => {
  for (const key of ["hour", "minute", "second"]) {
    const steps = Array.from({ length: 2400 }, (_, index) => {
      const t = index / 30;
      return spatialClockFrame(t + 1 / 30)[key] - spatialClockFrame(t)[key];
    });
    assert.ok(steps.some(step => step < 0), `${key} briefly turns back`);
    assert.ok(steps.some(step => step > 0), `${key} keeps travelling onward`);
    assert.ok(Math.max(...steps) - Math.min(...steps) > .0005, `${key} changes pace`);
    assert.ok(Math.max(...steps) < .02, `${key} remains continuous`);
  }
});

test("the opening clock visibly hesitates without jumping", () => {
  const frames = Array.from({ length: 79 }, (_, index) => startupClockFrame(index / 30));
  const secondSteps = frames.slice(1).map((frame, index) => frame.second - frames[index].second);
  const minuteSteps = frames.slice(1).map((frame, index) => frame.minute - frames[index].minute);
  assert.ok(secondSteps.some(step => step < 0), "the second hand briefly turns back during the opening");
  assert.ok(secondSteps.some(step => step > .8), "the second hand also moves forward at a visibly different pace");
  assert.ok(Math.max(...secondSteps.map(Math.abs)) < 2.5, "the opening hand remains continuous");
  assert.ok(Math.max(...minuteSteps) - Math.min(...minuteSteps) > .1, "the minute hand has its own changing pace");
  for (const value of Object.values(startupClockFrame(Infinity))) assert.ok(Number.isFinite(value));
});

test("the figure-eight SVG fallback is closed, finite and shares the clock centre", () => {
  assert.deepEqual(projectClockPoint(0, 0), [300, 325]);
  const rim = Array.from({ length: 97 }, (_, i) => [Math.sin(i / 96 * Math.PI * 2), Math.cos(i / 96 * Math.PI * 2)]);
  const path = clockSurfacePath(rim);
  assert.doesNotMatch(path, /NaN|Infinity|undefined/);
  assert.equal(path.split(" ").length, 97);
  assert.equal(path.split(" ")[0].slice(1), path.split(" ").at(-1).slice(1));
});

test("clock motion has manual, reduced-motion, offscreen and context-loss guards", async () => {
  const source = await readFile(new URL("../app/held-water.tsx", import.meta.url), "utf8");
  assert.match(source, /1000\/30/);
  assert.match(source, /motion\.matches \|\| pausedRef\.current/);
  assert.match(source, /lost \|\| !visible \|\| document\.hidden/);
  assert.match(source, /webglcontextlost/);
  assert.match(source, /aria-pressed=\{paused\}/);
  assert.match(source, /clockRing\(\.995\)/);
  assert.match(source, /spatialClockFrame\(elapsed\)/);
  assert.doesNotMatch(source, /new Date|fetch\(|TextureLoader|three\/|setInterval/);
});

test("the clock fits intermediate tablet widths without losing its pause control", async () => {
  const css = await readFile(new URL("../app/held-water.css", import.meta.url), "utf8");
  assert.match(css, /width:min\(600px,50vw\); height:min\(650px,58vw\)/);
  assert.match(css, /spatial-clock-pause[^}]*width:44px; height:44px/);
  assert.match(css, /width:min\(420px,calc\(100vw - 24px\)\)/);
});

test("visual scent moves within a small bounded field without flashes", () => {
  for (let t=0;t<10000;t+=.83) {
    const a=scentFrame(t),b=scentFrame(t+1/30);
    assert.ok(Math.abs(a.drift)<=9 && a.lift>=-14 && a.lift<=0);
    assert.ok(a.presence>=.5 && a.presence<=.86);
    assert.ok(Math.abs(a.presence-b.presence)<.001);
  }
  assert.deepEqual(scentFrame(Infinity),scentFrame(0));
});

test("all hands stay visually continuous through angle wraps and long sessions", () => {
  for (let t=0;t<24000;t+=.37) {
    const a=spatialClockFrame(t),b=spatialClockFrame(t+1/30);
    for (const key of ["hour","minute","second"]) {
      const delta=Math.atan2(Math.sin(b[key]-a[key]),Math.cos(b[key]-a[key]));
      // The second hand is deliberately more alive than the others, but at
      // 30fps it must still move by little more than one degree per paint.
      assert.ok(Math.abs(delta)<.02, `${key} jumped at ${t}`);
    }
  }
});

test("the full dial stays inside narrow, tablet and desktop canvases during motion", () => {
  assert.equal(clockViewportFit(600,650),1);
  assert.ok(clockViewportFit(296,430)<1,"narrow mobile clocks must scale down");
  for (const bad of [0,NaN,Infinity,-1]) assert.equal(clockViewportFit(bad,430),1);
  for (const [width,height] of [[296,430],[366,430],[420,430],[384,445],[600,650]]) {
    const scale=height/650*clockViewportFit(width,height);
    for (const x of [-.2,0,.2]) for (const y of [-.12,0,.12]) for (const breath of [-.045,.045]) {
      for (let i=0;i<360;i++) {
        const angle=i*Math.PI/180;
        const p=projectClockPoint(Math.sin(angle),Math.cos(angle),x,y,breath);
        const px=width/2+(p[0]-300)*scale,py=height/2+(p[1]-325)*scale;
        assert.ok(px>2 && px<width-2 && py>2 && py<height-2,`dial clipped at ${width}x${height}`);
      }
    }
  }
});

test("pause preserves the current pose and ripple while controls do not create ripples", async () => {
  const source=await readFile(new URL("../app/held-water.tsx",import.meta.url),"utf8");
  assert.match(source,/const leave = \(\) => \{ if \(still\(\)\) return/);
  assert.match(source,/targetX=currentX;targetY=currentY;lastTime=0/);
  assert.match(source,/elapsed-rippleStarted/);
  assert.match(source,/rippleStarted=elapsed/);
  assert.match(source,/event\.target\.closest\("button, a, input, textarea"\)/);
  assert.match(source,/uniform1f\(fit,clockViewportFit\(width,height\)\)/);
  assert.match(source,/float spiral=sin\(radius\*16\./);
  assert.match(source,/vortex\.classList\.add\("is-active"\)/);
});

test("a fine pointer draws a local memory distortion that settles after leaving", async () => {
  const source=await readFile(new URL("../app/held-water.tsx",import.meta.url),"utf8");
  assert.match(source,/\(hover: hover\) and \(pointer: fine\)/);
  assert.match(source,/hoverAmount \+= \(\(hovering \? 1 : 0\)-hoverAmount\)/);
  assert.match(source,/element\.dataset\.hovering=hovering \? "true" : "false"/);
  assert.match(source,/uniform4f\(ripple,rippleX,rippleY,rippleAge,hoverAmount\)/);
  assert.match(source,/hovering=false;element\.dataset\.hovering="false"/);
});

test("contact pulls a local point into a vortex without twisting the resting clock", async () => {
  const source=await readFile(new URL("../app/held-water.tsx",import.meta.url),"utf8");
  assert.match(source,/u_ripple\.w\*\.72/);
  assert.match(source,/vec2 spiralDelta=mat2\(cs,-sn,sn,cs\)\*delta/);
  assert.match(source,/spiralDelta\*max\(\.72,1\.-memory\*\.22\)/);
  assert.match(source,/const disturb = \(clientX: number, clientY: number, animate: boolean\)/);
  assert.match(source,/if \(hovering\) disturb\(event\.clientX,event\.clientY,!wasHovering\)/);
  assert.match(source,/disturb\(event\.clientX,event\.clientY,true\)/);
  assert.doesNotMatch(source,/float torsion=/);
  assert.match(source,/const moment=spatialClockFrame\(elapsed\)/);
  assert.match(source,/context\.uniform3f\(clock,moment\.hour,moment\.minute,moment\.second\)/);
});

test("soft material fields do not intercept input or leave a second clock running", async () => {
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  const page=await readFile(new URL("../app/trace-archive.tsx",import.meta.url),"utf8");
  assert.match(css,/period-sound-layer\)::before[^}]*pointer-events:none[^}]*mask-image:linear-gradient/);
  assert.match(page,/<SurrealClockField active=\{false\} \/>/);
  assert.match(page,/if \(!active \|\| window\.matchMedia/);
  assert.match(page,/if \(!active\) return null/);
});

test("scent uses the existing clock lifecycle and does not add a network or input layer", async () => {
  const svg=await readFile(new URL("../app/scent-field.tsx",import.meta.url),"utf8");
  const component=await readFile(new URL("../app/held-water.tsx",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  assert.doesNotMatch(svg,/fetch\(|https?:\/\/|requestAnimationFrame|setInterval|setTimeout|<image|<canvas/);
  assert.match(svg,/aria-hidden="true"/);
  assert.match(component,/element\.dataset\.scent === "on" && !motion\.matches/);
  assert.match(component,/data-scent="on"/);
  assert.doesNotMatch(component,/scent-toggle/);
  assert.match(css,/scent-field[^}]*pointer-events:none/);
  assert.match(css,/prefers-reduced-motion:reduce[^}]*scent-field[^}]*memory-vortex[^}]*display:none/);
  assert.match(css,/has-visual-scent \.spatial-depth-lines \{ opacity:0/);
});

test("the memory vortex is local, brief and visually restrained", async () => {
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  assert.match(css,/memory-vortex[^}]*pointer-events:none/);
  assert.match(css,/memory-vortex\.is-active[^}]*animation:memory-vortex 2\.4s/);
  assert.match(css,/@keyframes memory-vortex/);
});

test("the lower reading field is warm, legible and avoids a white glare", async () => {
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  assert.match(css,/--paper: #efebe3/);
  assert.match(css,/--ink: #292723/);
  assert.match(css,/--muted: #504b45/);
  assert.doesNotMatch(css,/encounter-section::before[^}]*#fffdf9/);
});
