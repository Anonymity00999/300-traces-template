export type SubmissionBody = Record<string, unknown>;

export type QueuedSubmission = {
  id: string;
  path: string;
  body: SubmissionBody;
  createdAt: string;
  attempts: number;
  status: "queued" | "sending" | "retry_wait" | "failed_permanent";
};

const DATABASE_NAME = "300-traces-archive";
const DATABASE_VERSION = 1;
const STORE_NAME = "submission-queue";

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `submission-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function database(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB could not open"));
  });
}

async function store(mode: IDBTransactionMode) {
  const db = await database();
  return { db, objectStore: db.transaction(STORE_NAME, mode).objectStore(STORE_NAME) };
}

export async function queueSubmission(path: string, body: SubmissionBody): Promise<QueuedSubmission> {
  const record: QueuedSubmission = { id: newId(), path, body, createdAt: new Date().toISOString(), attempts: 0, status: "queued" };
  const { db, objectStore } = await store("readwrite");
  await new Promise<void>((resolve, reject) => {
    const request = objectStore.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Submission could not be saved"));
  });
  db.close();
  return record;
}

export async function listQueuedSubmissions(): Promise<QueuedSubmission[]> {
  const { db, objectStore } = await store("readonly");
  const records = await new Promise<QueuedSubmission[]>((resolve, reject) => {
    const request = objectStore.getAll();
    request.onsuccess = () => resolve((request.result as QueuedSubmission[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error || new Error("Submission queue could not be read"));
  });
  db.close();
  return records;
}

async function updateSubmission(record: QueuedSubmission) {
  const { db, objectStore } = await store("readwrite");
  await new Promise<void>((resolve, reject) => {
    const request = objectStore.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Submission queue could not update"));
  });
  db.close();
}

export async function removeQueuedSubmission(id: string) {
  const { db, objectStore } = await store("readwrite");
  await new Promise<void>((resolve, reject) => {
    const request = objectStore.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Submission queue could not remove"));
  });
  db.close();
}

export function withSubmissionId(id: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  headers.set("x-archive-submission-id", id);
  return { ...init, headers };
}

export function retryableResponse(response: Response) {
  return response.status === 408 || response.status === 425 || response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
}

export async function flushQueuedSubmissions(send: (record: QueuedSubmission) => Promise<Response>): Promise<{ sent: number; retrying: number; failed: number }> {
  const records = await listQueuedSubmissions();
  const result = { sent: 0, retrying: 0, failed: 0 };
  for (const record of records) {
    if (record.status === "failed_permanent") continue;
    const sending = { ...record, status: "sending" as const, attempts: record.attempts + 1 };
    await updateSubmission(sending);
    try {
      const response = await send(sending);
      if (response.ok || response.status === 409) {
        await removeQueuedSubmission(record.id);
        result.sent += 1;
      } else if (retryableResponse(response)) {
        await updateSubmission({ ...sending, status: "retry_wait" });
        result.retrying += 1;
      } else {
        await updateSubmission({ ...sending, status: "failed_permanent" });
        result.failed += 1;
      }
    } catch {
      await updateSubmission({ ...sending, status: "retry_wait" });
      result.retrying += 1;
    }
  }
  return result;
}
