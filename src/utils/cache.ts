/* ============================================
   CLIENT-SIDE RESPONSE CACHE
   Persists weather responses in localStorage so
   a returning visitor (same location/date) gets
   an instant paint instead of waiting on the
   network again — complements useWeather's
   in-memory Map, which only lives as long as the
   component tree does, not across page reloads.
============================================ */

const CACHE_PREFIX = 'chrono-field:cache:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours — weather goes stale

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}

/** Reads a cached value if present and not expired. Returns null
 *  for missing, expired, or corrupted entries — callers should
 *  treat null as "fetch fresh," never throw on a cache miss. */
export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.storedAt;

    if (age > entry.ttlMs) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return entry.value;
  } catch {
    // Corrupted JSON, private-browsing storage restrictions, or any
    // other read failure — treat exactly like a cache miss.
    return null;
  }
}

/** Stores a value with a TTL. Silently no-ops on quota errors rather
 *  than throwing — a full cache should degrade to "no caching,"
 *  not break the feature that's using it. */
export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  try {
    const entry: CacheEntry<T> = { value, storedAt: Date.now(), ttlMs };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (err) {
    if (isQuotaError(err)) {
      // Best-effort recovery: clear our own expired entries and
      // retry once. If it still fails, give up quietly.
      clearExpired();
      try {
        const entry: CacheEntry<T> = { value, storedAt: Date.now(), ttlMs };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
      } catch {
        // Still full after clearing our own entries — not worth
        // fighting further; the app works fine without this cache.
      }
    }
    // Any other error (private browsing, storage disabled): no-op.
  }
}

/** Removes every expired entry this module owns. Safe to call
 *  opportunistically — never touches keys outside our own prefix. */
export function clearExpired(): void {
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_PREFIX)) continue;

      try {
        const entry: CacheEntry<unknown> = JSON.parse(localStorage.getItem(key)!);
        if (now - entry.storedAt > entry.ttlMs) {
          keysToRemove.push(key);
        }
      } catch {
        // Corrupted entry — remove it too, it's dead weight either way.
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable entirely — nothing to clear.
  }
}

/** Clears every entry this module owns. Exposed for a future
 *  "clear cache" control if one's ever needed. */
export function clearAll(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}
