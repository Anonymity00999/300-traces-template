import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const releaseFiles = [
  "app/api-base.ts", "app/data/public-snapshot.json", "app/participant-data.ts", "api/participant-export.ts", "app/scratch-film.tsx", "app/scratch-film.css", "app/data/scratch-films.ts", "app/data/film-entrance.ts", "app/trace-archive.tsx", "app/archive-service.ts", "app/page-copy.ts",
  "app/globals.css", "app/held-water.css", "app/held-water.tsx",
  "app/spatial-clock.ts", "app/scent-field.tsx", "app/reading-logic.ts",
  "app/data/trace-types.ts", "app/data/period-images.ts", "app/data/period-audio.ts",
  "app/data/period-events.ts", "api/_archive.ts", "api/community.ts",
  "api/progress.ts", "api/site-settings.ts", "vercel.json", "vite.static.config.ts",
];

const [manifestText, ...sources] = await Promise.all([
  readFile(resolve(root, "dist/version.json"), "utf8"),
  ...releaseFiles.map((file) => readFile(resolve(root, file))),
]);
const manifest = JSON.parse(manifestText);
const sourceHash = createHash("sha256").update(Buffer.concat(sources)).digest("hex");

if (manifest.region !== "global") throw new Error(`Expected a global release, received ${String(manifest.region)}.`);
if (manifest.sourceHash !== sourceHash) throw new Error("dist/version.json does not match the current release source. Build again; do not deploy a hand-edited dist folder.");
if (!manifest.traceCount || !manifest.datasetHash || !manifest.builtAt) throw new Error("The public release manifest is incomplete.");

console.log(`Release ready: ${manifest.releaseId} · ${manifest.traceCount} traces · ${manifest.sourceHash.slice(0, 12)}`);
