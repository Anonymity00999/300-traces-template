const finiteSeconds = (seconds: number) => Number.isFinite(seconds) ? Math.max(0, seconds) : 0;

/**
 * An imagined duration, deliberately not the visitor's local time.
 * Each hand follows several incommensurate waves. The movement remains
 * continuous, but can briefly be pulled backward before travelling on again.
 * It is an imagined duration rather than a measured clock.
 */
export function spatialClockFrame(seconds: number) {
  const t = finiteSeconds(seconds);
  return {
    hour: -.88 + t / 52 + .24 * Math.sin(t / 8.6 + .4) + .075 * Math.sin(t / 2.6 + .8) + .016 * Math.sin(t / .95),
    minute: .80 + t / 18 + .42 * Math.sin(t / 9.8 + .7) + .13 * Math.sin(t / 3.1) + .025 * Math.sin(t / 1.05 + .2),
    second: 2.35 + t / 4.3 + .40 * Math.sin(t / 3.6 + .2) + .17 * Math.sin(t / 1.25 + 1.4) + .028 * Math.sin(t / .52),
    breath: .045 * Math.sin(t / 17),
  };
}

/** A more legible version of the same wandering rhythm for the brief opening screen. */
export function startupClockFrame(seconds: number) {
  const t = finiteSeconds(seconds);
  return {
    hour: -8 + .7 * t + 4.4 * Math.sin(t * .62 + .3) + 1.2 * Math.sin(t * 1.85 + 1.1),
    minute: 12 + 2.8 * t + 8 * Math.sin(t * .95 + .6) + 2.4 * Math.sin(t * 2.25),
    second: 46 + 15 * t + 21 * Math.sin(t * 1.35 + .1) + 5.5 * Math.sin(t * 3.05 + 1.2),
  };
}

/** Match SVG's contain behavior even on narrow mobile canvases. */
export function clockViewportFit(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  return Math.min(1, (width / height) / (600 / 650));
}

/** SVG uses the neutral pose; optional motion values support projection checks. */
export function projectClockPoint(qx: number, qy: number, turnX = 0, turnY = 0, breath = 0): [number, number] {
  const waist = .50 + .55 * Math.sin(Math.abs(qy) * Math.PI);
  let x = qx * 1.30 * waist + .09 * qy * qy;
  let y = qy * 1.48 + .07 * Math.sin(qx * 2);
  let z = .38 * Math.sin(qy * 3.4 + breath) + .22 * qx * qy;
  const a = -.18 + turnY, b = -.47 + turnX, c = -.24;
  [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
  const perspective = 3.9 / (3.9 - z);
  return [300 + x * perspective * 650 / 3.7, 325 - y * perspective * 650 / 3.7];
}

export function clockSurfacePath(points: [number, number][]) {
  return points.map(([x, y], index) => {
    const [px, py] = projectClockPoint(x, y);
    return `${index ? "L" : "M"}${px.toFixed(2)},${py.toFixed(2)}`;
  }).join(" ");
}

/** Bounded, slow breathing; shares the clock's visible-only 30fps loop. */
export function scentFrame(seconds: number) {
  const t = finiteSeconds(seconds);
  return {
    drift: Math.sin(t / 13) * 9,
    lift: -7 - Math.sin(t / 17) * 7,
    presence: .68 + Math.sin(t / 11) * .18,
  };
}
