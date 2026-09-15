import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { ARCHIVE_CONFIG } from "../app/data/archive-config";

const DATA_FILES = ["trace-data-0.json", "trace-data-1.json", "trace-data-2.json"];
const RELEASE_FILES = ["app/api-base.ts", "app/data/public-snapshot.json", "app/participant-data.ts", "api/participant-export.ts", "app/scratch-film.tsx", "app/scratch-film.css", "app/data/scratch-films.ts", "app/data/film-entrance.ts", "app/trace-archive.tsx", "app/archive-service.ts", "app/page-copy.ts", "app/globals.css", "app/held-water.css", "app/held-water.tsx", "app/spatial-clock.ts", "app/scent-field.tsx", "app/reading-logic.ts", "app/data/trace-types.ts", "app/data/period-images.ts", "app/data/period-audio.ts", "app/data/period-events.ts", "api/_archive.ts", "api/community.ts", "api/progress.ts", "api/site-settings.ts", "vercel.json", "vite.static.config.ts"];

function gitCommit(root: string) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function archiveDataset(root: string) {
  const buffers = DATA_FILES.map((filename) => readFileSync(resolve(root, "app/data", filename)));
  const traceCount = buffers.reduce((total, buffer) => total + (JSON.parse(buffer.toString()) as unknown[]).length, 0);
  const datasetHash = createHash("sha256").update(Buffer.concat(buffers)).digest("hex");
  return { traceCount, datasetHash };
}

function releaseFingerprint(root: string) {
  const source = RELEASE_FILES.map((filename) => readFileSync(resolve(root, filename)));
  return createHash("sha256").update(Buffer.concat(source)).digest("hex");
}

/** Emits a small, public release fact sheet without exposing runtime secrets. */
export function releaseManifestPlugin(region: "global" | "mainland"): Plugin {
  return {
    name: "archive-release-manifest",
    generateBundle() {
      const root = resolve(import.meta.dirname, "..");
      const dataset = archiveDataset(root);
      const commit = gitCommit(root);
      const sourceHash = releaseFingerprint(root);
      const releaseToken = commit === "unknown" ? sourceHash : commit;
      const manifest = {
        releaseId: `${region}-${releaseToken.slice(0, 12)}`,
        commit,
        sourceHash,
        sourceFiles: Object.fromEntries(RELEASE_FILES.map((file) => [file, createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")])),
        builtAt: process.env.ARCHIVE_RELEASE_AT || new Date().toISOString(),
        region,
        ...dataset,
        targetCount: ARCHIVE_CONFIG.targetCount,
        schemaVersion: ARCHIVE_CONFIG.schemaVersion,
      };
      this.emitFile({ type: "asset", fileName: "version.json", source: `${JSON.stringify(manifest, null, 2)}\n` });
    },
  };
}
