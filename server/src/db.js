/**
 * db.js — MongoDB connection via Mongoose
 */

'use strict';

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const path = require('path');
const fs = require('fs');

// Try loading server/.env, then fallback to root .env if present
const serverEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');

if (fs.existsSync(serverEnvPath)) {
  require('dotenv').config({ path: serverEnvPath });
}
if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
}
require('dotenv').config();

// Auto-default NODE_ENV to 'production' if not explicitly set (e.g. in PM2/Docker) and not in tests
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'undefined') {
  const isTest = process.argv.some(arg => arg.includes('jest') || arg.includes('mocha'));
  process.env.NODE_ENV = isTest ? 'test' : 'production';
}

const mongoose = require('mongoose');

const buildMongoOptions = () => {
  const maxPool = parseInt(process.env.DB_MAX_POOL, 10) || 20;
  const minPool = parseInt(process.env.DB_MIN_POOL, 10) || 1;

  return {
    // 30 s for replica set topology discovery & failover
    serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10) || 30000,
    // 60 s for initial TCP/TLS handshake — prevents premature 'secureConnect' timeouts on network latency
    connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10) || 60000,
    // 60 s socket inactivity timeout
    socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 10) || 60000,
    // 15 s heartbeat frequency to keep sockets alive and detect drops quickly
    heartbeatFrequencyMS: parseInt(process.env.MONGO_HEARTBEAT_MS, 10) || 15000,
    maxPoolSize: maxPool,
    minPoolSize: minPool,
    family: 4, // Force IPv4 to avoid IPv6 connection timeout issues on Linux/Docker
    retryWrites: true,
    retryReads: true,
  };
};

let listenersAttached = false;

const attachConnectionListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    console.log(`✅  [MongoDB] Connected to database: ${mongoose.connection.host}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌  [MongoDB] Connection error:', err?.message || err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️   [MongoDB] Disconnected — Mongoose will auto-reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅  [MongoDB] Successfully reconnected to database');
  });

  mongoose.connection.on('close', () => {
    console.log('ℹ️   [MongoDB] Connection closed');
  });
};

/**
 * Connect to MongoDB with automatic retry and exponential backoff.
 * @param {number} maxRetries Maximum connection attempts before throwing (default 5)
 * @param {number} retryDelayMs Base delay between retries in ms (default 3000)
 */
const connect = async (maxRetries = 5, retryDelayMs = 3000) => {
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI && process.env.NODE_ENV !== 'test') {
    console.error('❌  MONGO_URI is not defined in environment variables');
    process.exit(1);
  }

  // If already connected, return existing connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  attachConnectionListeners();

  const options = buildMongoOptions();
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (attempt > 1) {
        console.log(`🔄  [MongoDB] Connecting to database (attempt ${attempt}/${maxRetries})...`);
      }
      await mongoose.connect(MONGO_URI, options);
      return mongoose.connection;
    } catch (err) {
      const isLastAttempt = attempt >= maxRetries;
      console.error(`⚠️   [MongoDB] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      if (isLastAttempt) {
        console.error(`❌  [MongoDB] Could not establish connection after ${maxRetries} attempts.`);
        throw err;
      }

      const backoff = retryDelayMs * Math.pow(1.5, attempt - 1);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = Math.round(backoff + jitter);
      console.log(`⏳  [MongoDB] Retrying in ${(delay / 1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = { connect, mongoose, buildMongoOptions };

