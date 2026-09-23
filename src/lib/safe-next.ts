const BASE = "http://localhost";

/**
 * Only same-site paths, so login links can't redirect to another site.
 * Resolving against a dummy origin catches tricks like "/\evil.com" or
 * "/\t/evil.com", which browsers treat as "//evil.com".
 */
export function safeNextPath(value: unknown, fallback = "/brain") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
