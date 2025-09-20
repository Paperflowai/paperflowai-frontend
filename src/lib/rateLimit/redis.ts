// Simple rate limiting with optional Redis support

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// In-memory store as fallback
let memoryStore: Map<string, { count: number; reset: number }> | null = null;

export async function checkLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  // For now, use simple in-memory implementation
  // Redis can be added later if needed
  return checkLimitMemory(identifier, limit, windowMs);
}

function checkLimitMemory(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  if (!memoryStore) {
    memoryStore = new Map();
  }
  
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const key = `${identifier}:${windowStart}`;
  
  const entry = memoryStore.get(key);
  
  if (!entry || now > entry.reset) {
    // New window - cleanup old entries
    for (const [k, v] of memoryStore.entries()) {
      if (v.reset < now) {
        memoryStore.delete(k);
      }
    }
    
    memoryStore.set(key, { count: 1, reset: windowEnd });
    
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: new Date(windowEnd)
    };
  }
  
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const success = entry.count <= limit;
  
  return {
    success,
    limit,
    remaining,
    reset: new Date(entry.reset),
    retryAfter: success ? undefined : Math.ceil((entry.reset - now) / 1000)
  };
}