/**
 * middleware/rateLimiters.js
 * 
 * Rate limiter configuration with Redis backend for production.
 * Falls back to memory-based limiting when Redis is unavailable (development).
 * 
 * DISABLE FOR TESTING:
 * Set environment variable: DISABLE_RATE_LIMIT=true
 * This disables ALL rate limiting for easier development/testing
 * 
 * PRODUCTION CONFIGURATION:
 * Set AUTH_LOGIN_RATE_LIMIT, API_RATE_LIMIT, STRICT_RATE_LIMIT, etc. as needed
 * Each limiter can be independently adjusted via environment variables
 * 
 * REDIS BACKEND:
 * Set REDIS_URL environment variable for distributed rate limiting
 * Example: REDIS_URL=redis://:password@hostname:port
 * This disables ALL rate limiting for easier development/testing
 * 
 * PRODUCTION CONFIGURATION:
 * Set AUTH_LOGIN_RATE_LIMIT, API_RATE_LIMIT, STRICT_RATE_LIMIT, etc. as needed
 * Each limiter can be independently adjusted via environment variables
 * 
 * REDIS BACKEND:
 * Set REDIS_URL environment variable for distributed rate limiting
 * Example: REDIS_URL=redis://:password@hostname:port
 */

'use strict';

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const redis = require('redis');
const logger = require('../utils/logger');
const { verifyToken } = require('../utils/jwt');

let redisClient = null;
let useRedis = false;

const normalizeIdentity = (value = '') =>
  String(value || '').trim().toLowerCase();

const tokenFromRequest = (req) => {
  const header = req?.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
};

const getUserIdFromToken = (req) => {
  const token = tokenFromRequest(req);
  if (!token) return '';
  try {
    const payload = verifyToken(token);
    return normalizeIdentity(payload?.id);
  } catch {
    return '';
  }
};

const getEmployeeIdFromBody = (req) =>
  normalizeIdentity(req?.body?.employeeId || req?.body?.empId || '');

const userAwareKey = (req, prefix = 'api') => {
  const userId = getUserIdFromToken(req);
  if (userId) return `${prefix}:user:${userId}`;
  const empId = getEmployeeIdFromBody(req);
  if (empId) return `${prefix}:emp:${empId}`;
  // Use ipKeyGenerator helper for IPv6 safety
  return `${prefix}:ip:${ipKeyGenerator(req)}`;
};

/**
 * Redis Store for express-rate-limit
 * Implements the store interface expected by express-rate-limit
 */
class RedisStore {
  constructor(client, prefix = 'ratelimit') {
    this.client = client;
    this.prefix = prefix;
  }

  async increment(key) {
    const fullKey = `${this.prefix}:${key}`;
    try {
      const value = await this.client.incr(fullKey);
      // Set expiration on first increment
      if (value === 1) {
        await this.client.expire(fullKey, 3600); // 1 hour default
      }
      return { totalHits: value, resetTime: new Date(Date.now() + 3600000) };
    } catch (err) {
      logger.error('Redis increment error', { error: err.message });
      // Fallback to memory (will be handled by express-rate-limit)
      throw err;
    }
  }

  async decrement(key) {
    const fullKey = `${this.prefix}:${key}`;
    try {
      await this.client.decr(fullKey);
    } catch (err) {
      logger.error('Redis decrement error', { error: err.message });
    }
  }

  async resetKey(key) {
    const fullKey = `${this.prefix}:${key}`;
    try {
      await this.client.del(fullKey);
    } catch (err) {
      logger.error('Redis reset error', { error: err.message });
    }
  }

  async resetAll() {
    try {
      const pattern = `${this.prefix}:*`;
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (err) {
      logger.error('Redis resetAll error', { error: err.message });
    }
  }
}

/**
 * Initialize Redis connection if configured
 * Safe to call multiple times (only connects once)
 */
const initializeRedis = async () => {
  if (useRedis || !process.env.REDIS_URL) {
    return;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      // Disable offline queue to avoid memory buildup
      enableOfflineQueue: false,
    });

    redisClient.on('error', (err) => {
      logger.warn('Redis connection error, falling back to memory store', { error: err.message });
      useRedis = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected for rate limiting');
      useRedis = true;
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    await redisClient.connect();
  } catch (err) {
    logger.warn('Redis initialization failed, using memory store', { error: err.message });
    useRedis = false;
  }
};

/**
 * Create a rate limiter with Redis backend if available
 */
const createLimiter = (options) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const prefix = options.prefix || 'default';
  
  // Allow disabling rate limiting via environment variable
  const disableLimiting = process.env.DISABLE_RATE_LIMIT === 'true';
  
  // Extract options that shouldn't be passed to rateLimit
  const { skip, message, handler, prefix: _prefix, ...rateLimitOptions } = options;
  
  // If rate limiting is disabled, return a no-op middleware
  if (disableLimiting) {
    return (req, res, next) => next();
  }
  
  const baseConfig = {
    windowMs: windowMs,
    max: rateLimitOptions.max || 100,
    standardHeaders: true,
    legacyHeaders: false,
    // Use default IP detection (handles IPv6 correctly)
    skip: skip || (() => false),
    message: message || {
      success: false,
      message: 'Request could not be processed at this time.',
    },
    handler: handler,
    ...rateLimitOptions,
  };

  // Use Redis store if connected
  if (useRedis && redisClient) {
    const redisStore = new RedisStore(redisClient, `rate-limit:${prefix}`);
    baseConfig.store = redisStore;
  }

  return rateLimit(baseConfig);
};

/**
 * LOGIN LIMITER
 * 
 * Purpose: Allow legitimate faculty to log in during peak times
 * 
 * Config:
 * - Window: 1 hour
 * - Max: 500 per IP per hour (supports concurrent device logins + retries)
 * - Can be disabled with DISABLE_RATE_LIMIT=true for testing
 * 
 * Why 500?
 * - Typical login flow: 1-2 requests per user
 * - 200+ concurrent users: ~400-800 unique IPs
 * - Retries for network issues: +20%
 * - Safety margin: handles all scenarios
 */
const loginLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 500),
  keyGenerator: (req) => {
    const empId = getEmployeeIdFromBody(req);
    // Keep a light IP signal to reduce brute-force abuse while preventing shared-WiFi lockouts.
    // Use ipKeyGenerator helper for IPv6 safety
    const ipHash = ipKeyGenerator(req);
    return empId ? `login:emp:${empId}:ip:${ipHash}` : `login:ip:${ipHash}`;
  },
  message: {
    success: false,
    message: 'Login request could not be processed at this time.',
  },
  prefix: 'login',
  // Campus/shared-WiFi safe mode: keep login open (no auth endpoint throttling).
  skip: () => true,
});

/**
 * PASSWORD RESET LIMITER
 * 
 * Purpose: Prevent brute-force password reset enumeration attacks
 * 
 * Config:
 * - Window: 15 minutes
 * - Max: 20 requests per IP per window (allows retries)
 * - Can be disabled with DISABLE_RATE_LIMIT=true
 */
const passwordResetLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: Number(process.env.AUTH_PASSWORD_RESET_RATE_LIMIT || 20),
  keyGenerator: (req) => {
    const empId = getEmployeeIdFromBody(req);
    // Use ipKeyGenerator helper for IPv6 safety
    const ipHash = ipKeyGenerator(req);
    return empId ? `pwd-reset:emp:${empId}` : `pwd-reset:ip:${ipHash}`;
  },
  message: {
    success: false,
    message: 'Password reset request could not be processed at this time.',
  },
  prefix: 'password-reset',
  // Keep forgot/reset endpoints open to avoid shared-network false positives.
  skip: () => true,
});

/**
 * GENERAL API LIMITER
 * 
 * Purpose: Protect all other API endpoints from general DOS attacks
 * 
 * Config:
 * - Window: 15 minutes
 * - Max: 2000 requests per IP per window (very generous for testing)
 * - Applied globally, but specific endpoints use stricter limiters
 * - Skips health checks
 * 
 * Development Note:
 * Disable with: DISABLE_RATE_LIMIT=true
 */
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: Number(process.env.API_RATE_LIMIT || 2000),
  keyGenerator: (req) => userAwareKey(req, 'api'),
  message: {
    success: false,
    message: 'Request could not be processed at this time.',
  },
  prefix: 'api',
  skip: (req) => {
    // Don't rate limit health checks or system endpoints
    return req.path === '/api/health'
      || req.path === '/health'
      || req.path === '/deva/health'
      || req.path === '/auth/login'
      || req.path === '/auth/forgot-password'
      || req.path === '/auth/reset-password';
  },
});

/**
 * STRICT LIMITER (Sensitive Operations)
 * 
 * Purpose: Protect sensitive endpoints like workload/faculty modifications
 * 
 * Config:
 * - Window: 1 hour
 * - Max: 500 per IP per hour (allows ~8 per minute - very generous)
 * - Applied only to POST/PUT/DELETE on sensitive routes
 * - Development: Can be disabled with DISABLE_RATE_LIMIT=true
 */
const strictLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,    // 1 hour
  max: Number(process.env.STRICT_RATE_LIMIT || 500),
  keyGenerator: (req) => userAwareKey(req, 'strict'),
  message: {
    success: false,
    message: 'Operation request could not be processed at this time.',
  },
  prefix: 'sensitive',
});

/**
 * EXPORT LIMITER
 * 
 * Purpose: Prevent resource exhaustion from bulk export requests
 * 
 * Config:
 * - Window: 1 hour
 * - Max: 50 exports per IP per hour (very generous for testing)
 * - Prevents abuse of data export features
 */
const exportLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,    // 1 hour
  max: Number(process.env.EXPORT_RATE_LIMIT || 50),
  keyGenerator: (req) => userAwareKey(req, 'export'),
  message: {
    success: false,
    message: 'Export request could not be processed at this time.',
  },
  prefix: 'export',
});

module.exports = {
  initializeRedis,
  loginLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  exportLimiter,
  // Utility for creating custom limiters
  createLimiter,
};
