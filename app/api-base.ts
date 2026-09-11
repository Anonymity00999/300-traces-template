const configuredApiBase = (import.meta.env.VITE_ARCHIVE_API_BASE || "").replace(/\/+$/, "");
const useCloudbaseBridge = import.meta.env.VITE_USE_CLOUDBASE_BRIDGE === "true";
const cloudbaseEnvironment = useCloudbaseBridge ? import.meta.env.VITE_CLOUDBASE_ENV_ID || "" : "";
const publicApiOrigin = "https://esthergather.cn";

function defaultApiBase() {
  if (configuredApiBase || typeof window === "undefined") return configuredApiBase;
  // The Sites-hosted reader is static, while the durable API remains on the
  // project's custom domain. Keep Vercel-hosted pages same-origin and only
  // bridge this known static preview host to the already-deployed API.
  return /(^|\.)chatgpt\.site$/i.test(window.location.hostname) ? publicApiOrigin : "";
}

/**
 * Keeps the reader usable on its original host while allowing any deployment
 * to point at one explicitly configured, provider-neutral API gateway.
 */
export function apiPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (cloudbaseEnvironment) return `cloudbase://archive-api${normalizedPath}`;
  const base = defaultApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function apiAbsolutePath(path: string, endpoint = apiPath(path)) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  if (typeof window === "undefined") return endpoint;
  return new URL(endpoint, window.location.origin).toString();
}
