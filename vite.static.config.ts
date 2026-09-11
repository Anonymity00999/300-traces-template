import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TITLE_TRANSLATIONS } from "./app/data/title-translations";
import { releaseManifestPlugin } from "./build/release-manifest";

function archiveData() {
  return {
    name: "archive-data",
    generateBundle(this: { emitFile: (asset: { type: "asset"; fileName: string; source: string | Buffer }) => void }) {
      for (const filename of ["trace-data-0.json", "trace-data-1.json", "trace-data-2.json"]) {
        this.emitFile({ type: "asset", fileName: `archive-data/${filename}`, source: readFileSync(resolve(import.meta.dirname, "app/data", filename)) });
      }
      this.emitFile({ type: "asset", fileName: "archive-data/title-translations.json", source: JSON.stringify(TITLE_TRANSLATIONS) });
    },
  };
}

// Some in-app browsers keep a previously fetched code-split chunk even after
// the HTML has revalidated. Make every public asset path carry a small source
// fingerprint, so a new reading release cannot be held back by an older chunk.
const assetRelease = createHash("sha256")
  .update(readFileSync(resolve(import.meta.dirname, "app/trace-archive.tsx")))
  .update(readFileSync(resolve(import.meta.dirname, "app/globals.css")))
  .update(readFileSync(resolve(import.meta.dirname, "app/instruction-library.tsx")))
  .digest("hex")
  .slice(0, 10);

export default defineConfig({
  plugins: [react(), archiveData(), releaseManifestPlugin("global")],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        archive: resolve(import.meta.dirname, "index.html"),
        instructionLibrary: resolve(import.meta.dirname, "instruction-library/index.html"),
        watchRoom: resolve(import.meta.dirname, "watch-room/index.html"),
      },
      output: {
        entryFileNames: `assets/[name]-[hash]-${assetRelease}.js`,
        chunkFileNames: `assets/[name]-[hash]-${assetRelease}.js`,
        assetFileNames: `assets/[name]-[hash]-${assetRelease}[extname]`,
        manualChunks(id) {
          if (id.includes("node_modules/react-dom")) return "vendor-react-dom";
          if (id.includes("node_modules/react")) return "vendor-react";
          if (id.includes("/app/")) return `archive-${id.split("/").pop()?.replace(/\.[^.]+$/, "")}`;
        },
      },
    },
  },
});
