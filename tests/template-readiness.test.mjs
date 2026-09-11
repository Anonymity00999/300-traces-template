import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("template keeps the static reading core", () => {
  const reader = read("app/trace-archive.tsx");
  const data = read("app/data/traces.ts");
  assert.match(reader, /Meet an unread trace/);
  assert.match(reader, /localStorage/);
  assert.match(data, /trace-data-0\.json/);
});

test("template keeps a safe deployment boundary", () => {
  const ignore = read(".gitignore");
  const config = read("vercel.json");
  assert.match(ignore, /\.env\*/);
  assert.match(config, /buildCommand/);
});
