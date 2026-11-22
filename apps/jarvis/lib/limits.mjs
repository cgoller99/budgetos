/** In-memory limiter, plus Upstash REST when those two variables are already configured. */
export function createLimiter({ fetchImpl = fetch, now = () => Date.now() } = {}) {
  const buckets = new Map();

  function localAllow(key, limit, windowMs) {
    const time = now();
    const entry = buckets.get(key);
    if (!entry || time > entry.reset) {
      buckets.set(key, { count: 1, reset: time + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  return {
    async allow({ key, limit, windowMs, env }) {
      const url = env?.UPSTASH_REDIS_REST_URL?.trim();
      const token = env?.UPSTASH_REDIS_REST_TOKEN?.trim();
      if (!url || !token) return { allowed: localAllow(key, limit, windowMs), shared: false };
      try {
        const base = url.replace(/\/$/, "");
        const response = await fetchImpl(`${base}/incr/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) return { allowed: localAllow(key, limit, windowMs), shared: false, degraded: true };
        const body = await response.json();
        const count = Number(body?.result ?? body);
        if (count === 1) {
          await fetchImpl(`${base}/expire/${encodeURIComponent(key)}/${Math.ceil(windowMs / 1000)}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(3000),
          }).catch(() => undefined);
        }
        if (!Number.isInteger(count)) return { allowed: localAllow(key, limit, windowMs), shared: false, degraded: true };
        return { allowed: count <= limit, shared: true };
      } catch {
        return { allowed: localAllow(key, limit, windowMs), shared: false, degraded: true };
      }
    },
  };
}
