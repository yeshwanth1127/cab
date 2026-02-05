/**
 * Redis client setup
 * Falls back to in-memory cache if Redis is not available
 */

let redisClient = null;
let inMemoryCache = new Map();
const IN_MEMORY_TTL = 10 * 60 * 1000; // 10 minutes

// Try to initialize Redis
try {
  const redis = require('redis');
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.warn('[Redis] Max reconnection attempts reached, falling back to in-memory cache');
          redisClient = null;
          return new Error('Redis connection failed');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  redisClient.on('error', (err) => {
    console.warn('[Redis] Error:', err.message);
    console.warn('[Redis] Falling back to in-memory cache');
    redisClient = null;
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  // Connect (non-blocking)
  redisClient.connect().catch(() => {
    console.warn('[Redis] Connection failed, using in-memory cache');
    redisClient = null;
  });
} catch (error) {
  console.warn('[Redis] Redis not installed, using in-memory cache');
  console.warn('[Redis] Install with: npm install redis');
  redisClient = null;
}

/**
 * Get value from cache (Redis or in-memory)
 */
async function get(key) {
  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('[Redis] Get error, falling back to in-memory:', error.message);
      return getFromMemory(key);
    }
  }
  return getFromMemory(key);
}

/**
 * Set value in cache (Redis or in-memory)
 */
async function set(key, value, ttlSeconds = 600) {
  const serialized = JSON.stringify(value);
  
  if (redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, serialized);
      return;
    } catch (error) {
      console.warn('[Redis] Set error, falling back to in-memory:', error.message);
      setInMemory(key, value, ttlSeconds);
      return;
    }
  }
  setInMemory(key, value, ttlSeconds);
}

/**
 * Delete value from cache
 */
async function del(key) {
  if (redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (error) {
      console.warn('[Redis] Delete error:', error.message);
    }
  }
  inMemoryCache.delete(key);
}

// In-memory cache helpers
function getFromMemory(key) {
  const entry = inMemoryCache.get(key);
  if (!entry) return null;
  
  const { value, expires } = entry;
  if (Date.now() > expires) {
    inMemoryCache.delete(key);
    return null;
  }
  return value;
}

function setInMemory(key, value, ttlSeconds) {
  const expires = Date.now() + (ttlSeconds * 1000);
  inMemoryCache.set(key, { value, expires });
  
  // Cleanup expired entries periodically
  if (inMemoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of inMemoryCache.entries()) {
      if (v.expires < now) {
        inMemoryCache.delete(k);
      }
    }
  }
}

module.exports = {
  get,
  set,
  del,
  isRedisAvailable: () => redisClient !== null
};
