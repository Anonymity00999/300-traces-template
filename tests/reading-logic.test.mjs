import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { traceId,traceIsRead,traceCandidates,nextDistinctId,nextTraceId,periodSelection,hasTraceExcerpt,translationFor } from "../app/reading-logic.ts";

const traces=Array.from({length:8},(_,i)=>({id:i+1,sourceId:`source-${i+1}`,type:i===7?"idea":"article",title:`Article ${i+1}`,excerpt:"A real excerpt",sourceUrl:`https://example.com/${i+1}`}));
test("the seven article entries can be encountered without an early repeat",()=>{
  const seen=new Set(),read=new Set();let current="";
  for(let i=0;i<7;i++) {
    const pool=traceCandidates(traces,"article",read,current,seen);
    assert.ok(pool.length);const next=pool[0];
    assert.equal(next.type,"article");assert.ok(!seen.has(traceId(next)));
    current=traceId(next);seen.add(current);
  }
  assert.equal(read.size,0,"drawing never marks content read");
  assert.ok(traceCandidates(traces,"article",read,current,seen).every(t=>traceId(t)!==current));
});
test("unread priority, single-entry filters and an empty collection are safe",()=>{
  const read=new Set(["trace-source-1","2","trace-3"]);
  assert.ok(traceCandidates(traces,"article",read,"source-4",new Set()).every(t=>!traceIsRead(read,t)));
  assert.equal(traceCandidates(traces,"idea",read,"source-8",new Set()).length,1);
  assert.deepEqual(traceCandidates([],"article",read,"",new Set()),[]);
  const almostRead=new Set(traces.slice(1).map(t=>`trace-${traceId(t)}`));
  assert.ok(traceCandidates(traces,"all",almostRead,"source-1",new Set()).every(t=>traceId(t)!=="source-1"));
});
test("a rapid second draw cannot leave the already-visible trace on screen",()=>{
  const candidates=[traces[1],traces[2],traces[3]];
  assert.equal(nextTraceId(candidates,"source-2",()=>0),"source-3");
  assert.equal(nextTraceId([traces[1]],"source-2",()=>0),"source-2");
  assert.equal(nextTraceId([],"source-2",()=>0),"source-2");
});
test("a rapid second image draw cannot keep the image already on screen",()=>{
  const images=[{id:"image-1"},{id:"image-2"},{id:"image-3"}];
  assert.equal(nextDistinctId(images,"image-1",(image)=>image.id,()=>0),"image-2");
  assert.equal(nextDistinctId(images,"image-3",(image)=>image.id,()=>.99),"image-1");
  assert.equal(nextDistinctId([],"image-1",(image)=>image.id,()=>0),null);
});
test("legacy reading keys are recognised without counting unrelated kinds",()=>{
  for(const key of ["source-1","1","trace-source-1","trace-1"]) assert.ok(traceIsRead(new Set([key]),traces[0]));
  assert.equal(traceIsRead(new Set(["image-source-1","audio-1"]),traces[0]),false);
});
test("dated refresh fills with unseen entries then non-current cards without duplicates",()=>{
  const current=["source-1","source-2","source-3"],seen=new Set(traces.slice(0,6).map(traceId));
  const result=periodSelection(traces,seen,current,()=>.2);
  assert.equal(result.length,3);assert.equal(new Set(result.map(traceId)).size,3);
  assert.ok(result.slice(0,2).every(t=>!seen.has(traceId(t))));
  assert.ok(result.every(t=>!current.includes(traceId(t))));
  assert.equal(periodSelection(traces.slice(0,2),new Set(),[],()=>.5).length,2);
  assert.deepEqual(periodSelection([],seen,current),[]);
});
test("placeholder excerpts are not presented or translated as content",()=>{
  for(const s of ["想法","  想法 ","文章","回答","Idea",undefined,""]) assert.equal(hasTraceExcerpt(s),false);
  assert.equal(hasTraceExcerpt("这是一个关于海的想法。"),true);
});
test("a translation is only displayed with its own source article",()=>{
  const translation={traceId:"source-1",title:"One",excerpt:"Only article one"};
  assert.equal(translationFor(traces[0],translation),translation);
  assert.equal(translationFor(traces[1],translation),null);
});
test("the complete archive retains unique HTTPS source links and all three types",async()=>{
  const data=(await Promise.all([0,1,2].map(async i=>JSON.parse(await readFile(new URL(`../app/data/trace-data-${i}.json`,import.meta.url),"utf8"))))).flat();
  assert.equal(data.length,294);
  assert.equal(new Set(data.map(t=>t.sourceUrl)).size,294);
  assert.equal(new Set(data.map(t=>t.sourceId)).size,294);
  for(const t of data) { assert.equal(new URL(t.sourceUrl).protocol,"https:");assert.ok(t.title && t.author); }
  for(const type of ["idea","article","answer"]) assert.ok(data.some(t=>t.type===type));
});
test("prepared data preserves supplied English titles and brightness does not erase the surface",async()=>{
  const data=await readFile(new URL("../app/data/trace-types.ts",import.meta.url),"utf8");
  const shader=await readFile(new URL("../app/held-water.tsx",import.meta.url),"utf8");
  assert.match(data,/trace\.titleEn\?\.trim\(\) \|\| TITLE_TRANSLATIONS/);
  assert.match(shader,/float texture = current\*\.018\+striation\*\.009\+grain\*\.008/);
  assert.match(shader,/float alpha = \(\.57/);
  assert.doesNotMatch(shader,/vec3\(1\.,\.974,\.903\)/);
});
test("main film defaults by language and only mounts Vimeo on its selected path",async()=>{
  const source=await readFile(new URL("../app/trace-archive.tsx",import.meta.url),"utf8");
  const entrance=source.slice(source.indexOf("function MediaEntrance("),source.indexOf("function RelatedLinksSection("));
  assert.match(entrance,/影像即将抵达/);
  assert.match(entrance,/href=\{bilibiliVideoUrl\}/);
  assert.match(entrance,/locale === "en" \? "vimeo" : "bilibili"/);
  assert.match(entrance,/route === "vimeo" && embed/);
  assert.match(entrance,/event.source !== iframe.current\?\.contentWindow/);
  assert.doesNotMatch(entrance,/<video|zhihuVideoUrl/);
});
test("desktop depth and dated reading layout do not override the mobile surface",async()=>{
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  assert.match(css,/@media \(min-width:761px\)[\s\S]*filter:brightness\(\.78\) contrast\(1\.08\) saturate\(\.88\)/);
  assert.match(css,/period-fragment-main \{ display:grid;[^}]*grid-template-columns:minmax\(150px,19%\) minmax\(0,1fr\)/);
  assert.match(css,/\.period-fragments \{ grid-template-columns:1fr;[^}]*background:transparent; \}/);
  assert.match(css,/\.period-memory::before/);
  assert.match(css,/\.period-sound-layer::after/);
  assert.match(css,/repeating-linear-gradient\(180deg,#39746b0d/);
  assert.match(css,/\.trace-card h3 \{ max-width:720px; font-size:clamp\(24px,2\.15vw,31px\)/);
  assert.doesNotMatch(css,/held-arrival/);
});
test("the dated image and article stages keep stable geometry while content changes",async()=>{
  const css=await readFile(new URL("../app/held-water.css",import.meta.url),"utf8");
  assert.match(css,/period-image-stack \{ position:relative; align-self:start; width:100%; min-height:0; aspect-ratio:4 \/ 3/);
  assert.match(css,/period-image-stack > \.period-image-primary \{ position:absolute; inset:0;[^}]*aspect-ratio:auto/);
  assert.match(css,/@media \(min-width:761px\)[\s\S]*period-fragments \{[^}]*grid-template-rows:repeat\(3,150px\)[^}]*height:450px/);
  assert.match(css,/period-fragment-main strong \{[^}]*-webkit-line-clamp:2/);
  assert.match(css,/period-fragment-main \.period-fragment-excerpt \{[^}]*-webkit-line-clamp:1/);
  assert.match(css,/period-timeline-date \{[^}]*white-space:nowrap;[^}]*word-break:keep-all/);
  assert.match(css,/@media \(max-width:760px\)[\s\S]*period-fragments \{[^}]*grid-template-rows:repeat\(3,180px\)[^}]*height:540px/);
});
