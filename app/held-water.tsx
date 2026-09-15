import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { clockSurfacePath, clockViewportFit, spatialClockFrame, scentFrame } from "./spatial-clock";
import { ScentField } from "./scent-field";

const clockRing = (radius: number) => clockSurfacePath(Array.from({ length: 97 }, (_, i) => [Math.sin(i / 96 * Math.PI * 2) * radius, Math.cos(i / 96 * Math.PI * 2) * radius]));
const fallbackHands = spatialClockFrame(0);
const handPath = (angle: number, length: number) => clockSurfacePath(Array.from({ length: 20 }, (_, i) => [Math.sin(angle) * length * i / 19, Math.cos(angle) * length * i / 19]));

/** Decorative glass study. It neither loads textures nor reads the visitor's data.
 * WebGL is optional: the SVG stays visible until the first successful draw.
 * Clock drawing is capped at 30fps and stops offscreen, hidden, or when paused.
 * Reduced motion retains a static clock. No wall time or personal data is read.
 */
export function SpatialGlass({ locale }: { locale: "zh" | "en" }) {
  const id = useId().replace(/:/g, "");
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const refreshMotion = useRef<(() => void) | null>(null);
  useEffect(() => {
    const element = host.current, surface = canvas.current;
    if (!element || !surface) return;
    element.dataset.renderer = "fallback";
    if (!("IntersectionObserver" in window) || !("ResizeObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!motion.addEventListener) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = surface.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power" });
    } catch { return; }
    if (!gl) return;
    const context = gl;
    const shaders: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0, lost = false, visible = false;
    let elapsed = 0, lastTime = 0, lastPaint = 0;
    let width = 1, height = 1;
    let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
    let rippleStarted = -10000, rippleX = 0, rippleY = 0;
    let hovering = false, hoverAmount = 0;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const scope = element.parentElement!;
    const vortex = element.querySelector<HTMLElement>(".memory-vortex");
    const compile = (kind: number, source: string) => {
      const shader = context.createShader(kind);
      if (!shader) throw new Error("Decorative shader unavailable");
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) throw new Error(context.getShaderInfoLog(shader) || "Decorative shader unavailable");
      return shader;
    };
    try {
      program = context.createProgram();
      if (!program) throw new Error("Decorative program unavailable");
      context.attachShader(program, compile(context.VERTEX_SHADER, [
        "attribute vec2 a_uv;",
        "uniform vec2 u_turn;",
        "uniform float u_aspect;",
        "uniform float u_fit;",
        "uniform vec4 u_ripple;",
        "uniform float u_breath;",
        "varying vec3 v_normal;",
        "varying vec3 v_position;",
        "varying vec2 v_uv;",
        "vec3 shape(vec2 q) {",
        " vec2 delta=q-u_ripple.xy;",
        " float radius=length(delta);",
        " float life=max(0.,1.-u_ripple.z/2.4);",
        " float arrival=smoothstep(0.,.14,u_ripple.z);",
        " float memory=max(arrival*life,u_ripple.w*.72)*exp(-radius*2.05);",
        " float twist=memory*(1.55+.24*sin(u_ripple.z*3.+u_breath));",
        " float cs=cos(twist),sn=sin(twist);",
        " vec2 spiralDelta=mat2(cs,-sn,sn,cs)*delta;",
        " q=u_ripple.xy+spiralDelta*max(.72,1.-memory*.22);",
        " float waist = .50 + .55*sin(abs(q.y)*3.14159265);",
        " float x = q.x * 1.30 * waist;",
        " float y = q.y * 1.48;",
        " float z = .38 * sin(q.y * 3.4 + u_breath) + .22 * q.x * q.y;",
        " float spiral=sin(radius*16.-u_ripple.z*5.+atan(delta.y,delta.x)*2.);",
        " z += spiral*.072*memory-exp(-radius*6.)*.06*memory;",
        " return vec3(x + .09*q.y*q.y, y + .07*sin(q.x*2.), z);",
        "}",
        "mat3 rotation() {",
        " float a = -.18 + u_turn.y, b = -.47 + u_turn.x, c = -.24;",
        " mat3 rx = mat3(1.,0.,0., 0.,cos(a),sin(a), 0.,-sin(a),cos(a));",
        " mat3 ry = mat3(cos(b),0.,-sin(b), 0.,1.,0., sin(b),0.,cos(b));",
        " mat3 rz = mat3(cos(c),sin(c),0., -sin(c),cos(c),0., 0.,0.,1.);",
        " return rz*ry*rx;",
        "}",
        "void main() {",
        " vec2 q = a_uv*2.-1.;",
        " mat3 r = rotation();",
        " vec3 p = r * shape(q);",
        " vec3 du = shape(q+vec2(.002,0.))-shape(q-vec2(.002,0.));",
        " vec3 dv = shape(q+vec2(0.,.002))-shape(q-vec2(0.,.002));",
        " v_normal = normalize(r * cross(du,dv));",
        " v_position = p; v_uv = a_uv;",
        " float perspective = 3.9/(3.9-p.z);",
        " gl_Position = vec4(p.x*perspective*u_fit/(1.85*u_aspect),p.y*perspective*u_fit/1.85,-p.z*.1,1.);",
        "}"
      ].join("\n")));
      const fragmentPrecision=context.getShaderPrecisionFormat(context.FRAGMENT_SHADER,context.HIGH_FLOAT)?.precision ? "highp" : "mediump";
      context.attachShader(program, compile(context.FRAGMENT_SHADER, [
        `precision ${fragmentPrecision} float;`,
        "varying vec3 v_normal;",
        "varying vec3 v_position;",
        "varying vec2 v_uv;",
        "uniform vec3 u_clock;",
        "float line(vec2 p, float angle, float reach, float thickness) {",
        " vec2 tip=vec2(sin(angle),cos(angle))*reach;",
        " float along=clamp(dot(p,tip)/dot(tip,tip),-.12,1.);",
        " return 1.-smoothstep(thickness,thickness+.005,length(p-tip*along));",
        "}",
        "void main() {",
        " vec2 q = v_uv*2.-1.;",
        " float boundary = length(q);",
        " float mask = 1.-smoothstep(.992,1.,boundary);",
        " if(mask<.005) discard;",
        " vec3 n = normalize(v_normal);",
        " vec3 eye = normalize(vec3(0.,0.,3.9)-v_position);",
        " float fresnel = pow(1.-abs(dot(n,eye)),2.);",
        " float rim = smoothstep(.925,.987,boundary);",
        " float lip = exp(-pow((boundary-.987)*180.,2.));",
        " float side = .5+.5*dot(n,normalize(vec3(-.9,.6,1.)));",
        " float reflection = exp(-pow((dot(n,normalize(vec3(.7,.45,1.)))-.78)*15.,2.));",
        " float horizon = exp(-pow((v_uv.y-.46+n.x*.065)*48.,2.));",
        // Sea-glass / cooled wax: diffuse body, fixed fine striations, no white bloom.
        " float current = sin(q.y*19.+sin(q.x*4.4)*1.6+q.x*1.8);",
        " float striation = sin(q.y*61.+sin(q.x*7.)*2.5);",
        " float grain = sin(q.x*135.+sin(q.y*41.)*1.8)*sin(q.y*151.+sin(q.x*19.));",
        " float texture = current*.018+striation*.009+grain*.008;",
        " float shade = .72 - .12*fresnel - .07*rim + .035*reflection - texture;",
        " vec3 sea = vec3(shade*.965,shade*1.01,shade*1.015);",
        " vec3 wax = vec3(shade*1.055,shade*1.005,shade*.94);",
        " vec3 color = mix(sea,wax,.32+.25*smoothstep(.3,.95,v_uv.y));",
        " color = mix(color,vec3(.87,.845,.795),reflection*.16);",
        " color -= horizon*.07;",
        " color = mix(color,vec3(.88,.87,.83),lip*.32);",
        " color = mix(color,vec3(.42,.40,.36),rim*(1.-side)*.35);",
        " float alpha = (.57+.18*fresnel+.17*rim+.04*reflection+.05*lip)*mask;",
        " float angle=atan(q.x,q.y);",
        " float tick=1.-smoothstep(.032,.063,abs(sin(angle*30.)));",
        " float major=1.-smoothstep(.012,.027,abs(sin(angle*6.)));",
        " float ticks=max(tick*smoothstep(.825,.835,boundary),major*smoothstep(.76,.77,boundary))*(1.-smoothstep(.879,.889,boundary));",
        " float dial=(1.-smoothstep(.003,.008,abs(boundary-.911)))*.26;",
        " float hours=line(q,u_clock.x,.49,.010);",
        " float minutes=line(q,u_clock.y,.72,.006);",
        " float seconds=line(q,u_clock.z,.79,.002);",
        " float pivot=1.-smoothstep(.022,.031,boundary);",
        " float marks=max(ticks*.70,dial);",
        " float ink=max(marks,max(hours*.95,minutes*.88));",
        " color=mix(color,vec3(.39,.36,.32),max(marks,minutes*.88));",
        " color=mix(color,vec3(.25,.24,.22),hours*.95);",
        " color=mix(color,vec3(.57,.36,.25),seconds*.78);",
        " color=mix(color,vec3(.25,.24,.22),pivot*.95);",
        " alpha=max(alpha,max(max(ink,pivot*.95),seconds*.62))*mask;",
        " gl_FragColor = vec4(color,alpha);",
        "}"
      ].join("\n")));
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error("Decorative program unavailable");
      buffer = context.createBuffer();
      if (!buffer) throw new Error("Decorative buffer unavailable");
      const points: number[] = [];
      const columns = 44, rows = 52;
      for (let y=0; y<rows; y++) for (let x=0; x<columns; x++) {
        const u=x/columns,v=y/rows,du=1/columns,dv=1/rows;
        points.push(u,v,u+du,v,u,v+dv,u+du,v,u+du,v+dv,u,v+dv);
      }
      context.useProgram(program);
      context.enable(context.DEPTH_TEST);
      context.bindBuffer(context.ARRAY_BUFFER,buffer);
      context.bufferData(context.ARRAY_BUFFER,new Float32Array(points),context.STATIC_DRAW);
      const location = context.getAttribLocation(program,"a_uv");
      context.enableVertexAttribArray(location);
      context.vertexAttribPointer(location,2,context.FLOAT,false,0,0);
      const turn = context.getUniformLocation(program,"u_turn");
      const aspect = context.getUniformLocation(program,"u_aspect");
      const fit = context.getUniformLocation(program,"u_fit");
      const ripple = context.getUniformLocation(program,"u_ripple");
      const clock = context.getUniformLocation(program,"u_clock");
      const breath = context.getUniformLocation(program,"u_breath");
      const still = () => motion.matches || pausedRef.current;
      const draw = (timestamp: number) => {
        frame = 0;
        if (lost || !visible || document.hidden) return;
        if (!still() && timestamp-lastPaint<1000/30) { frame=requestAnimationFrame(draw);return; }
        if (lastTime && !still()) elapsed+=Math.min(.1,(timestamp-lastTime)/1000);
        lastTime=timestamp;lastPaint=timestamp;
        const moment=spatialClockFrame(elapsed);
        const factor = still() ? 1 : .14;
        currentX += (targetX-currentX)*factor;
        currentY += (targetY-currentY)*factor;
        hoverAmount += ((hovering ? 1 : 0)-hoverAmount)*(still() ? 1 : .09);
        context.viewport(0,0,width,height);
        context.clearColor(0,0,0,0);
        context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT);
        context.uniform2f(turn,currentX,currentY);
        context.uniform1f(aspect,width/height);
        context.uniform1f(fit,clockViewportFit(width,height));
        // Ripple and hands share elapsed time, so pausing freezes the whole surface.
        const rippleAge = motion.matches ? 10 : Math.min(10,elapsed-rippleStarted);
        context.uniform4f(ripple,rippleX,rippleY,rippleAge,hoverAmount);
        context.uniform3f(clock,moment.hour,moment.minute,moment.second);
        context.uniform1f(breath,moment.breath);
        context.drawArrays(context.TRIANGLES,0,points.length/2);
        element.dataset.renderer = "webgl";
        element.dataset.motion = still() ? "static" : "running";
        element.style.setProperty("--glass-x",(currentX*20).toFixed(2)+"px");
        element.style.setProperty("--glass-y",(currentY*-14).toFixed(2)+"px");
        if (element.dataset.scent === "on" && !motion.matches) {
          const air=scentFrame(elapsed);
          element.style.setProperty("--scent-x",air.drift.toFixed(2)+"px");
          element.style.setProperty("--scent-y",air.lift.toFixed(2)+"px");
          element.style.setProperty("--scent-presence",air.presence.toFixed(3));
        }
        if (!still()) frame = requestAnimationFrame(draw);
      };
      const request = () => { if (!frame && !lost && visible && !document.hidden) frame=requestAnimationFrame(draw); };
      const resize = () => {
        const rect=element.getBoundingClientRect();
        const ratio=Math.min(window.devicePixelRatio||1,1.5);
        width=Math.max(1,Math.round(rect.width*ratio));
        height=Math.max(1,Math.round(rect.height*ratio));
        surface.width=width; surface.height=height;
        request();
      };
      const disturb = (clientX: number, clientY: number, animate: boolean) => {
        const rect=element.getBoundingClientRect();
        if (clientX<rect.left || clientX>rect.right || clientY<rect.top || clientY>rect.bottom) return false;
        rippleX=(clientX-rect.left)/rect.width*2-1;
        rippleY=1-(clientY-rect.top)/rect.height*2;
        if (animate && vortex) {
          vortex.style.setProperty("--vortex-x",`${((clientX-rect.left)/rect.width*100).toFixed(2)}%`);
          vortex.style.setProperty("--vortex-y",`${((clientY-rect.top)/rect.height*100).toFixed(2)}%`);
          vortex.classList.remove("is-active");
          void vortex.offsetWidth;
          vortex.classList.add("is-active");
        }
        rippleStarted=elapsed;request();return true;
      };
      const move = (event: PointerEvent) => {
        if (still() || !finePointer.matches || !visible) return;
        const rect=scope.getBoundingClientRect();
        targetX=Math.max(-.2,Math.min(.2,(event.clientX-rect.left-rect.width/2)/rect.width*.4));
        targetY=Math.max(-.12,Math.min(.12,(event.clientY-rect.top-rect.height/2)/rect.height*.24));
        const glassRect=element.getBoundingClientRect();
        const wasHovering=hovering;
        hovering=event.clientX>=glassRect.left && event.clientX<=glassRect.right && event.clientY>=glassRect.top && event.clientY<=glassRect.bottom;
        element.dataset.hovering=hovering ? "true" : "false";
        if (hovering) disturb(event.clientX,event.clientY,!wasHovering);
        request();
      };
      const leave = () => { if (still()) return; hovering=false;element.dataset.hovering="false";targetX=0;targetY=0;request(); };
      const down = (event: PointerEvent) => {
        // Operating the quiet controls must not also disturb the glass below them.
        if (still() || !visible || (event.target instanceof Element && event.target.closest("button, a, input, textarea"))) return;
        disturb(event.clientX,event.clientY,true);
      };
      const scroll = () => {
        if (still() || finePointer.matches || !visible) return;
        const rect=element.getBoundingClientRect();
        targetY=Math.max(-.12,Math.min(.12,(rect.top+rect.height/2-window.innerHeight/2)/window.innerHeight*.24));
        request();
      };
      const preference = () => {
        targetX=currentX;targetY=currentY;lastTime=0;request();
      };
      refreshMotion.current=preference;
      const visibility = () => {
        lastTime=0;
        if (document.hidden) { cancelAnimationFrame(frame);frame=0;element.dataset.motion="offscreen"; }
        else request();
      };
      const onLost = () => {
        lost=true;cancelAnimationFrame(frame);frame=0;lastTime=0;
        element.dataset.renderer="fallback";
        element.dataset.motion="static";
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible=entry.isIntersecting;
        lastTime=0;
        if (visible) { resize();scroll();request(); }
        else { cancelAnimationFrame(frame);frame=0;element.dataset.motion="offscreen"; }
      });
      const sizeObserver = new ResizeObserver(resize);
      observer.observe(element);sizeObserver.observe(element);
      scope.addEventListener("pointermove",move,{passive:true});
      scope.addEventListener("pointerleave",leave);
      scope.addEventListener("pointerdown",down,{passive:true});
      window.addEventListener("scroll",scroll,{passive:true});
      document.addEventListener("visibilitychange",visibility);
      motion.addEventListener("change",preference);
      surface.addEventListener("webglcontextlost",onLost);
      return () => {
        refreshMotion.current=null;
        cancelAnimationFrame(frame);observer.disconnect();sizeObserver.disconnect();
        scope.removeEventListener("pointermove",move);scope.removeEventListener("pointerleave",leave);
        scope.removeEventListener("pointerdown",down);
        window.removeEventListener("scroll",scroll);document.removeEventListener("visibilitychange",visibility);
        motion.removeEventListener("change",preference);surface.removeEventListener("webglcontextlost",onLost);
        context.deleteBuffer(buffer);context.deleteProgram(program);shaders.forEach(shader=>context.deleteShader(shader));
      };
    } catch (error) {
      console.warn("Spatial glass is using its static fallback.", error);
      element.dataset.renderer="fallback";
      context.deleteBuffer(buffer);context.deleteProgram(program);shaders.forEach(shader=>context.deleteShader(shader));
    }
  }, []);
  return <div className="spatial-clock-stage has-visual-scent">
    <div className="spatial-glass" ref={host} aria-hidden="true" data-renderer="fallback" data-motion="static" data-scent="on">
    <ScentField />
    <div className="spatial-depth-lines"><i /><i /><i /></div>
    <div className="spatial-shadow" />
    <svg className="spatial-fallback" viewBox="0 0 600 650" focusable="false">
      <defs>
        <linearGradient id={id+"-glass"} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#c6c2b5" stopOpacity=".82" /><stop offset=".3" stopColor="#a5afae" stopOpacity=".62" />
          <stop offset=".66" stopColor="#b8b3a5" stopOpacity=".56" /><stop offset=".91" stopColor="#968f7f" stopOpacity=".68" />
          <stop offset="1" stopColor="#d9d5c8" stopOpacity=".8" />
        </linearGradient>
        <pattern id={id+"-grain"} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)"><path d="M0 2 H9 M0 7 H9" stroke="#626e6b" strokeWidth=".6" opacity=".12" /></pattern>
      </defs>
      <path d={clockRing(.995)+" Z"} fill={"url(#"+id+"-glass)"} stroke="#9f917e" strokeOpacity=".64" />
      <path d={clockRing(.974)+" Z"} fill={"url(#"+id+"-grain)"} />
      <path d={clockRing(.976)} fill="none" stroke="#fffaf0" strokeOpacity=".85" strokeWidth="2" />
      <g fill="none" stroke="#62574c" strokeLinecap="round">
        <path d={clockRing(.911)} opacity=".25" />
        {Array.from({length:60},(_,i)=>{
          const angle=i/60*Math.PI*2,inner=i%5===0?.77:.835;
          return <path key={i} d={clockSurfacePath([[Math.sin(angle)*inner,Math.cos(angle)*inner],[Math.sin(angle)*.88,Math.cos(angle)*.88]])} strokeWidth={i%5===0?1.4:.8} opacity=".65" />;
        })}
        <path d={handPath(fallbackHands.hour,.49)} stroke="#403d38" strokeWidth="3" />
        <path d={handPath(fallbackHands.minute,.72)} stroke="#645c52" strokeWidth="1.8" />
        <path d={handPath(fallbackHands.second,.79)} stroke="#916044" strokeWidth="1" />
      </g>
      <circle cx="300" cy="325" r="3.8" fill="#62574c" />
    </svg>
    <canvas ref={canvas} className="spatial-canvas" />
    <span className="memory-vortex" />
    </div>
    <button className="spatial-clock-pause" type="button" aria-pressed={paused} aria-label={locale==="zh"?(paused?"继续时钟":"暂停时钟"):(paused?"Resume clock":"Pause clock")} onClick={()=>{pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);refreshMotion.current?.();}}><span aria-hidden="true">{paused?"▷":"Ⅱ"}</span></button>
  </div>;
}

export function PeriodTimeline({ entries, selected, locale, label, onSelect }: {
  entries: { date: string; traces: unknown[] }[];
  selected: string;
  locale: "zh" | "en";
  label: string;
  onSelect: (date: string) => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % entries.length
      : event.key === "ArrowLeft" ? (index - 1 + entries.length) % entries.length
      : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
    onSelect(entries[next].date);
  }
  return <div className="period-timeline" role="tablist" aria-label={label}>
    {entries.map((entry, index) => <button key={entry.date} className={entry.date === selected ? "is-active" : ""} type="button" role="tab" aria-selected={entry.date === selected} tabIndex={entry.date === selected ? 0 : -1} onClick={() => onSelect(entry.date)} onKeyDown={(event) => onKeyDown(event, index)}>
      <span className="period-timeline-date">{locale === "zh" ? `3月${Number(entry.date.slice(-2))}日` : `Mar ${Number(entry.date.slice(-2))}`}</span><small>{entry.traces.length}</small>
    </button>)}
  </div>;
}
