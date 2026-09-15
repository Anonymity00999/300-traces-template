import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const hardErrors = [];
const warnings = [];
const traceFiles = ["trace-data-0.json", "trace-data-1.json", "trace-data-2.json"];
const traces = traceFiles.flatMap((filename) => {
  const path = resolve(root, "app/data", filename);
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(data)) throw new Error("not an array");
    return data.map((trace, index) => ({ ...trace, __file: filename, __index: index }));
  } catch (error) {
    hardErrors.push(`${filename}: cannot read JSON (${error instanceof Error ? error.message : "unknown error"})`);
    return [];
  }
});

const allowedTypes = new Set(["idea", "article", "answer"]);
const seenSourceIds = new Map();
for (const trace of traces) {
  const label = `${trace.__file}[${trace.__index}]`;
  for (const field of ["sourceId", "title", "excerpt", "sourceUrl"]) {
    if (typeof trace[field] !== "string" || !trace[field].trim()) hardErrors.push(`${label}: missing ${field}`);
  }
  if (!allowedTypes.has(trace.type)) hardErrors.push(`${label}: invalid type ${String(trace.type)}`);
  if (typeof trace.sourceUrl === "string" && !/^https:\/\//i.test(trace.sourceUrl)) hardErrors.push(`${label}: sourceUrl must use https`);
  if (typeof trace.sourceId === "string") {
    if (seenSourceIds.has(trace.sourceId)) hardErrors.push(`${label}: duplicate sourceId ${trace.sourceId} (also ${seenSourceIds.get(trace.sourceId)})`);
    else seenSourceIds.set(trace.sourceId, label);
  }
  if (trace.createdAt && (typeof trace.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/.test(trace.createdAt))) warnings.push(`${label}: createdAt is not in the expected date format`);
}

if (traces.length !== 300) warnings.push(`archive contains ${traces.length} traces; target is 300`);
const referenceOnly=traces.filter(trace=>/^(想法|文章|回答|idea|article|answer)$/i.test(trace.excerpt?.trim() || ""));
if (referenceOnly.length) warnings.push(`${referenceOnly.length} traces have placeholder-only excerpts; retain their original links, do not describe them as saved full text`);

const periodImageSource = readFileSync(resolve(root, "app/data/period-images.ts"), "utf8");
const imageUrls = [...periodImageSource.matchAll(/imageUrl:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const imageUrl of imageUrls) {
  if (imageUrl.startsWith("/")) {
    const asset = resolve(root, "public", imageUrl.slice(1));
    if (!existsSync(asset)) hardErrors.push(`period image asset missing: ${imageUrl}`);
  }
}
const periodDates = [...periodImageSource.matchAll(/date:\s*"(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]);
const allowedDates = new Set(Array.from({ length: 7 }, (_, index) => `2026-03-${String(16 + index).padStart(2, "0")}`));
for (const date of periodDates) if (!allowedDates.has(date)) hardErrors.push(`period image has date outside 2026-03-16..22: ${date}`);
for (const date of allowedDates) {
  const count = periodDates.filter((value) => value === date).length;
  if (count < 3) warnings.push(`${date}: only ${count} period images; preferred minimum is 3`);
}
if (imageUrls.length && periodDates.length < imageUrls.length) warnings.push("some period image records may be missing source-date metadata");

const periodAudioSource = readFileSync(resolve(root, "app/data/period-audio.ts"), "utf8");
const audioDates = [...periodAudioSource.matchAll(/date:\s*"(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]);
for (const date of audioDates) if (!allowedDates.has(date)) hardErrors.push(`period audio has date outside 2026-03-16..22: ${date}`);
for (const date of allowedDates) if (!audioDates.includes(date)) warnings.push(`${date}: no date-bound audio source found`);
const playbackRoutes = [...periodAudioSource.matchAll(/playbackUrl:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const route of playbackRoutes) {
  if (/^https?:\/\//i.test(route)) hardErrors.push(`period audio playback must be same-origin or local: ${route}`);
  if (route.startsWith("/")) {
    const asset = resolve(root, "public", route.slice(1));
    if (!existsSync(asset)) hardErrors.push(`period audio asset missing: ${route}`);
  }
}
const localDownloadRoutes = [...periodAudioSource.matchAll(/downloadUrl:\s*"(\/[^\"]+)"/g)].map((match) => match[1]);
for (const route of localDownloadRoutes) if (!existsSync(resolve(root, "public", route.slice(1)))) hardErrors.push(`period audio download asset missing: ${route}`);
if (playbackRoutes.length && playbackRoutes.some((route) => !route.startsWith("/period-audio/"))) warnings.push("some approved sound playback routes are not using the same-origin period-audio directory");

const translationsPath = resolve(root, "app/data/title-translations.ts");
if (!existsSync(translationsPath)) hardErrors.push("title translation map is missing");

try {
  const snapshot = JSON.parse(readFileSync(resolve(root, "app/data/public-snapshot.json"), "utf8"));
  for (const collection of ["traces", "guestbook", "media", "events"]) {
    for (const item of Array.isArray(snapshot[collection]) ? snapshot[collection] : []) {
      if (item.status && item.status !== "approved") hardErrors.push(`public snapshot contains non-approved ${collection} record ${item.id || "unknown"}`);
    }
  }
} catch (error) {
  hardErrors.push(`public-snapshot.json: cannot read (${error instanceof Error ? error.message : "unknown error"})`);
}

console.log(`Content QA: ${traces.length}/300 traces, ${imageUrls.length} period images, ${audioDates.length} dated audio records`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.log(`- ${warning}`);
}
if (hardErrors.length) {
  console.error(`Hard errors (${hardErrors.length}):`);
  for (const error of hardErrors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Hard errors: 0");
}
