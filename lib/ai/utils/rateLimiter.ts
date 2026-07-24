import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;

// Initialize Redis if URL exists
if (redisUrl) {
  try {
    redis = new Redis(redisUrl);
    console.log('[RateLimiter] Redis initialized successfully.');
  } catch (error) {
    console.error('[RateLimiter] Redis initialization failed, falling back to in-memory.', error);
  }
} else {
  console.log('[RateLimiter] REDIS_URL not set. Using in-memory rate limiting.');
}

// In-memory fallback cache
const inMemoryCache = new Map<string, { count: number; expiresAt: number }>();

// Daily limits per agent type
const DAILY_LIMITS: Record<string, number> = {
  chat: 50,
  web_search: 10,
  image_generation: 10,
  code_generation: 15,
  pdf_generation: 5,
  voice_generation: 20,
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: string;
}

function getResetTime(): string {
  const nextReset = new Date();
  nextReset.setUTCHours(23, 59, 59, 999);
  return nextReset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getKey(userId: string, agentType: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `rateLimit:${userId}:${agentType}:${today}`;
}

/**
 * Get current rate limit stats for a user and agent type WITHOUT consuming a request.
 */
export async function getRateLimitStats(userId: string, agentType: string): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[agentType] || 20;
  const key = getKey(userId, agentType);
  const resetTimeStr = getResetTime();

  let count = 0;

  if (redis) {
    try {
      const current = await redis.get(key);
      count = current ? parseInt(current, 10) : 0;
    } catch (redisError) {
      console.warn('[RateLimiter] Redis read failed, checking in-memory:', (redisError as Error).message);
      const cacheItem = inMemoryCache.get(key);
      if (cacheItem && cacheItem.expiresAt > Date.now()) {
        count = cacheItem.count;
      }
    }
  } else {
    const cacheItem = inMemoryCache.get(key);
    if (cacheItem && cacheItem.expiresAt > Date.now()) {
      count = cacheItem.count;
    }
  }

  const remaining = Math.max(0, limit - count);

  return {
    allowed: remaining > 0,
    limit,
    remaining,
    resetTime: resetTimeStr,
  };
}

/**
 * Check and consume 1 request unit for an agent type.
 * Returns allowed: true if under limit and incremented, allowed: false if limit reached.
 */
export async function consumeRateLimit(userId: string, agentType: string): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[agentType] || 20;
  const key = getKey(userId, agentType);
  const resetTimeStr = getResetTime();
  const now = Date.now();

  // 1. Redis
  if (redis) {
    try {
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetTime: resetTimeStr,
        };
      }

      const multi = redis.multi();
      multi.incr(key);
      multi.expire(key, 86400); // 24 hours
      await multi.exec();

      return {
        allowed: true,
        limit,
        remaining: limit - (count + 1),
        resetTime: resetTimeStr,
      };
    } catch (redisError) {
      console.warn('[RateLimiter] Redis incr failed, falling back to in-memory:', (redisError as Error).message);
    }
  }

  // 2. In-Memory Fallback
  const nextReset = new Date();
  nextReset.setUTCHours(23, 59, 59, 999);
  const expiresAt = nextReset.getTime();

  const cacheItem = inMemoryCache.get(key);

  if (cacheItem && cacheItem.expiresAt > now) {
    if (cacheItem.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetTime: resetTimeStr,
      };
    }

    cacheItem.count += 1;
    return {
      allowed: true,
      limit,
      remaining: limit - cacheItem.count,
      resetTime: resetTimeStr,
    };
  } else {
    if (cacheItem) inMemoryCache.delete(key);

    inMemoryCache.set(key, { count: 1, expiresAt });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetTime: resetTimeStr,
    };
  }
}

// Backward compatibility alias: checkRateLimit now reads stats without incrementing
export const checkRateLimit = getRateLimitStats;
