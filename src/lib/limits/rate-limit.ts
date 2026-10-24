type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window limiter. Each serverless instance keeps its own map, so the
 * limit is per instance. Use it as a cheap abuse brake, not a billing control.
 */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clearRateLimits(): void {
  buckets.clear();
}
