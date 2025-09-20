// Rate limiting with Redis (Upstash) or in-memory fallback

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Simple in-memory fallback if Redis not available
let memoryStore: Map<string, { count: number; reset: number }> | null = null;

export async function checkLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  // Try Redis first if configured
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken) {
    try {
      return await checkLimitRedis(identifier, limit, windowMs, redisUrl, redisToken);
    } catch (error) {
      console.warn('Redis rate limiting failed, falling back to memory:', error);
      // Fall through to memory implementation
    }
  }
  
  // Memory fallback
  return checkLimitMemory(identifier, limit, windowMs);
}

async function checkLimitRedis(
  identifier: string,
  limit: number,
  windowMs: number,
  url: string,
  token: string
): Promise<RateLimitResult> {
  const window = Math.floor(Date.now() / windowMs);
  const key = `rate_limit:${identifier}:${window}`;
  
  // Use Upstash REST API
  const response = await fetch(`${url}/incr/${key}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Redis API error: ${response.status}`);
  }
  
  const data = await response.json();
  const current = data.result;
  
  // Set expiry for new key
  if (current === 1) {
    await fetch(`${url}/expire/${key}/${Math.ceil(windowMs / 1000)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  const remaining = Math.max(0, limit - current);
  const reset = new Date((window + 1) * windowMs);
  
  return {
    success: current <= limit,
    limit,
    remaining,
    reset,
    retryAfter: current > limit ? Math.ceil(windowMs / 1000) : undefined
  };
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
