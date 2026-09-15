import { useId } from "react";

/** Sea air below, a small trace of extinguished candle above. No own timer or media. */
export function ScentField() {
  const id = useId().replace(/:/g, "");
  const path = "M445 524 C559 456 584 349 503 294 C451 259 474 205 536 169 C583 141 580 91 518 32";
  return <svg className="scent-field" viewBox="0 0 600 650" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id+"-air"} gradientUnits="userSpaceOnUse" x1="445" y1="524" x2="518" y2="32">
        <stop stopColor="#788d91" stopOpacity="0" />
        <stop offset=".23" stopColor="#829496" stopOpacity=".5" />
        <stop offset=".52" stopColor="#b09273" stopOpacity=".7" />
        <stop offset=".8" stopColor="#ad977b" stopOpacity=".44" />
        <stop offset="1" stopColor="#c4b49c" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={id+"-warmth"}>
        <stop stopColor="#b59a78" stopOpacity=".16" /><stop offset="1" stopColor="#d4c5ab" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id+"-sea"}><stop stopColor="#748f96" stopOpacity=".2" /><stop offset="1" stopColor="#bccacb" stopOpacity="0" /></radialGradient>
      <filter id={id+"-diffuse"} x="-35%" y="-10%" width="170%" height="120%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id={id+"-soft"} x="-10%" y="-4%" width="120%" height="108%" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".65" />
      </filter>
    </defs>
    <ellipse cx="333" cy="507" rx="224" ry="89" fill={"url(#"+id+"-sea)"} />
    <ellipse cx="514" cy="203" rx="64" ry="158" fill={"url(#"+id+"-warmth)"} />
    <g className="scent-drift" fill="none" stroke={"url(#"+id+"-air)"} strokeLinecap="round">
      <path d={path} strokeWidth="23" opacity=".7" filter={"url(#"+id+"-diffuse)"} />
      <path d={path} strokeWidth="2.2" opacity=".7" filter={"url(#"+id+"-soft)"} />
    </g>
  </svg>;
}
