const base = (import.meta.env.VITE_ARCHIVE_API_BASE || "").replace(/\/+$/, "");
export function apiPath(path: string) { return base + (path.startsWith("/") ? path : "/" + path); }
export function apiAbsolutePath(path: string, endpoint = apiPath(path)) { return /^https?:\/\//i.test(endpoint) || typeof window === "undefined" ? endpoint : new URL(endpoint, window.location.origin).toString(); }
