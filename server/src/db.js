/**
 * db.js — MongoDB connection via Mongoose
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌  MONGO_URI is not defined in .env');
  process.exit(1);
}

const connect = async () => {
  await mongoose.connect(MONGO_URI, {
    // Keep connections alive across idle periods (Atlas M0 closes idle sockets)
    serverSelectionTimeoutMS: 10000,   // fail fast if Atlas is unreachable (10 s)
    socketTimeoutMS:          45000,   // close sockets that hang longer than 45 s
    heartbeatFrequencyMS:     30000,   // check server every 30 s to detect drops
    maxPoolSize:              10,
    minPoolSize:              2,
    family:                   4,       // force IPv4 — avoids IPv6 resolution delays
  });
  console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] disconnected — Mongoose will auto-reconnect');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[MongoDB] reconnected');
  });
};

module.exports = { connect, mongoose };

