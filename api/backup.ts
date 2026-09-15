import { del, list } from "@vercel/blob";
import { bodyOf, isAdmin, listJson, readJson, rebuildPublicCommunityIndex, sendJson, writeJson, type PublicCommunityIndex } from "./_archive.js";

const BACKUP_SCHEMA_VERSION = 1;
type BackupRecord = { id: string; status: "pending" | "approved" | "not-used"; [key: string]: unknown };
type BackupSnapshot = {
  backupSchemaVersion: 1;
  createdAt: string;
  note: string;
  records: { pending: BackupRecord[]; approved: BackupRecord[]; notUsed: BackupRecord[] };
  settings: { siteCopy: Record<string, unknown> | null; atmosphere: Record<string, unknown> | null };
  publicIndex: PublicCommunityIndex | null;
};

function asRecords(value: unknown): BackupRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is BackupRecord => Boolean(item && typeof item === "object" && typeof (item as BackupRecord).id === "string" && typeof (item as BackupRecord).status === "string"));
}

async function makeSnapshot(): Promise<BackupSnapshot> {
  const [pending, approved, notUsed, siteCopy, atmosphere, publicIndex] = await Promise.all([
    listJson<BackupRecord>("submissions/pending/"),
    listJson<BackupRecord>("submissions/approved/"),
    listJson<BackupRecord>("submissions/not-used/"),
    readJson<Record<string, unknown>>("settings/site-copy.json"),
    readJson<Record<string, unknown>>("settings/atmosphere.json"),
    readJson<PublicCommunityIndex>("public/community-index.json"),
  ]);
  return {
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    note: "资料库备份；恢复时只补回缺少的记录，不删除当前资料。媒体文件保留为同一 Blob 资料库中的路径。",
    records: { pending, approved, notUsed },
    settings: { siteCopy, atmosphere },
    publicIndex: publicIndex ?? null,
  };
}

function safeId(value: unknown) { return typeof value === "string" && /^[\w-]{20,80}$/.test(value); }

async function restoreSnapshot(snapshot: unknown) {
  const source = snapshot && typeof snapshot === "object" ? snapshot as Partial<BackupSnapshot> : {};
  if (source.backupSchemaVersion !== BACKUP_SCHEMA_VERSION || !source.records || typeof source.records !== "object") throw new Error("backup schema");
  const records = source.records as BackupSnapshot["records"];
  const groups: Array<[keyof BackupSnapshot["records"], "pending" | "approved" | "not-used"]> = [["pending", "pending"], ["approved", "approved"], ["notUsed", "not-used"]];
  let restored = 0;
  for (const [field, folder] of groups) {
    for (const item of asRecords(records[field])) {
      if (!safeId(item.id)) continue;
      const pathname = `submissions/${folder}/${item.id}.json`;
      if (!await readJson<BackupRecord>(pathname)) {
        await writeJson(pathname, { ...item, status: folder === "not-used" ? "not-used" : folder });
        restored += 1;
      }
    }
  }
  const settings: Partial<BackupSnapshot["settings"]> = source.settings && typeof source.settings === "object" ? source.settings as BackupSnapshot["settings"] : {};
  if (settings.siteCopy && typeof settings.siteCopy === "object") await writeJson("settings/site-copy.json", settings.siteCopy);
  if (settings.atmosphere && typeof settings.atmosphere === "object") await writeJson("settings/atmosphere.json", settings.atmosphere);
  await rebuildPublicCommunityIndex();
  return restored;
}

async function pruneOldBackups() {
  const found = await list({ prefix: "backups/", limit: 1000 });
  const old = found.blobs
    .sort((a, b) => new Date(String(b.uploadedAt)).getTime() - new Date(String(a.uploadedAt)).getTime())
    .slice(12);
  await Promise.all(old.map((blob) => del(blob.pathname)));
}

export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (!isAdmin(req)) return sendJson(res, 401, { error: "审核钥匙不正确。" });
  try {
    if (req.method === "GET") {
      const snapshot = await makeSnapshot();
      const stamp = snapshot.createdAt.replace(/[:.]/g, "-");
      const pathname = `backups/archive-${stamp}-${crypto.randomUUID().slice(0, 8)}.json`;
      await writeJson(pathname, snapshot);
      await pruneOldBackups();
      res.setHeader("cache-control", "no-store").setHeader("content-disposition", `attachment; filename="300-traces-backup-${stamp}.json"`);
      return sendJson(res, 200, snapshot);
    }
    if (req.method === "POST") {
      const input = bodyOf(req);
      if (input.action !== "restore") return sendJson(res, 400, { error: "没有收到恢复动作。" });
      const restored = await restoreSnapshot(input.snapshot);
      return sendJson(res, 200, { ok: true, restored, message: `已补回 ${restored} 条缺少的资料；现有资料没有被删除。阅读页设置已按这份备份恢复。` });
    }
    return sendJson(res, 405, { error: "只允许下载或恢复备份。" });
  } catch {
    return sendJson(res, 500, { error: "备份暂时没有完成，请稍后再试。" });
  }
}
