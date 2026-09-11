import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { ARCHIVE_CONFIG } from "../app/data/archive-config";

const DATA_FILES = ["trace-data-0.json", "trace-data-1.json", "trace-data-2.json"];

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

/** Emits a small, public release fact sheet without exposing runtime secrets. */
export function releaseManifestPlugin(region: "global" | "mainland"): Plugin {
  return {
    name: "archive-release-manifest",
    generateBundle() {
      const root = resolve(import.meta.dirname, "..");
      const dataset = archiveDataset(root);
      const commit = gitCommit(root);
      const manifest = {
        releaseId: `${region}-${commit.slice(0, 12)}`,
        commit,
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
