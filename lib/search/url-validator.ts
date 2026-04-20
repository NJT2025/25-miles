/**
 * Validate that a website URL resolves to a real server.
 * Returns false only on network-level failures (ENOTFOUND, timeout, etc.)
 * A 4xx/5xx response is still considered valid — the domain exists.
 */
export async function validateWebsiteUrl(url: string): Promise<boolean> {
  if (!url) return false
  const normalized = url.startsWith("http") ? url : `https://${url}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    await fetch(normalized, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    })
    clearTimeout(timeout)
    return true
  } catch {
    // ENOTFOUND, ECONNREFUSED, AbortError (timeout) — domain does not exist
    return false
  }
}

/**
 * Validate multiple URLs in parallel.
 * Returns a Map of url → valid.
 */
export async function validateWebsiteUrls(urls: string[]): Promise<Map<string, boolean>> {
  const seen = new Set<string>()
  const unique = urls.filter((u) => { if (!u || seen.has(u)) return false; seen.add(u); return true })
  const results = await Promise.all(unique.map(async (url) => [url, await validateWebsiteUrl(url)] as const))
  return new Map(results)
}
