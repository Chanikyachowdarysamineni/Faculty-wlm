/**
 * utils/cache.js
 * 
 * Caching layer for high-traffic data
 * Ready for Redis integration (currently using in-memory cache)
 */

'use strict';

// In-memory cache (can be replaced with Redis)
class CacheManager {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  /**
   * Get value from cache
   */
  get(key) {
    const now = Date.now();
    const ttl = this.ttls.get(key);

    if (ttl && ttl < now) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }

    return this.store.get(key) || null;
  }

  /**
   * Set value in cache with optional TTL (milliseconds)
   */
  set(key, value, ttl = null) {
    this.store.set(key, value);
    if (ttl) {
      this.ttls.set(key, Date.now() + ttl);
    }
  }

  /**
   * Delete key from cache
   */
  delete(key) {
    this.store.delete(key);
    this.ttls.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.store.clear();
    this.ttls.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

const cache = new CacheManager();

/**
 * Middleware to cache GET requests based on path + query
 */
const caching = (ttl = 5 * 60 * 1000) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.path}:${JSON.stringify(req.query)}`;
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      cache.set(cacheKey, data, ttl);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
};

/**
 * Clear cache for a pattern
 */
const clearCachePattern = (pattern) => {
  const keys = Array.from(cache.store.keys());
  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  });
};

/**
 * Cache invalidation helper
 */
const invalidateCache = (paths = []) => {
  if (paths.length === 0) {
    cache.clear();
  } else {
    paths.forEach((path) => clearCachePattern(path));
  }
};

module.exports = {
  cache,
  caching,
  clearCachePattern,
  invalidateCache,
};
