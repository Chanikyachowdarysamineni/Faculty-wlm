/**
 * index.js — Faculty Work Load Management API Server
 *
 * Start:      node src/index.js
 * Dev mode:   npm run dev
 * Seed DB:    npm run seed
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// ── Validate Required Environment Variables ────────────────
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_ORIGIN'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌  MISSING REQUIRED ENVIRONMENT VARIABLES: ${missingEnvVars.join(', ')}`);
  logger.error('Please ensure all required variables are set in .env file');
  process.exit(1);
}

// Warn if NODE_ENV is not production in production-like environment
if (process.env.MONGO_URI?.includes('mongodb') && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  NODE_ENV is not set to "production" - consider setting it for better performance');
}

const express      = require('express');
const http         = require('http');
const https        = require('https');
const fs           = require('fs');
const cors         = require('cors');
const morgan       = require('morgan');
const helmet       = require('helmet');
const compression  = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { initializeRedis, apiLimiter, strictLimiter } = require('./middleware/rateLimiters');

// ── Import routes ──────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const facultyRoutes     = require('./routes/faculty');
const coursesRoutes     = require('./routes/courses');
const submissionsRoutes = require('./routes/submissions');
const workloadsRoutes   = require('./routes/workloads');
const settingsRoutes    = require('./routes/settings');
const statsRoutes       = require('./routes/stats');
const allocationsRoutes = require('./routes/allocations');
const auditLogsRoutes   = require('./routes/auditLogs');
const facultyPreferencesRoutes = require('./routes/faculty-preferences');
const facultyCapacityRoutes = require('./routes/facultyCapacity');
const designationsRoutes = require('./routes/designations');

// ── Import WebSocket handler ────────────────────────────────
const WebSocketHandler  = require('./websocket');

// ── DB (Mongoose) ────────────────────────────────────────────
const { connect } = require('./db');
const Setting     = require('./models/Setting');
const Workload    = require('./models/Workload');
const Course      = require('./models/Course');
const CourseAllocation = require('./models/CourseAllocation');
const AuditLog = require('./models/AuditLog');
const Counter = require('./models/Counter');
const PasswordResetToken = require('./models/PasswordResetToken');
const { syncAuthAndRBAC } = require('./utils/authSync');

const DEFAULT_SECTIONS = {
  I: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  II: Array.from({ length: 22 }, (_, i) => String(i + 1)),
  III: Array.from({ length: 19 }, (_, i) => String(i + 1)),
  IV: Array.from({ length: 9 }, (_, i) => String(i + 1))
};

const normalizeCourseTypeKey = (courseType = '') => {
  const normalized = String(courseType || '').trim().toLowerCase();
  if (normalized === 'de' || normalized === 'department elective') return 'DE';
  if (normalized === 'mandatory') return 'MANDATORY';
  return 'OTHER';
};

const backfillWorkloadCourseTypeKeys = async () => {
  const docs = await Workload.find(
    {
      $or: [
        { courseTypeKey: { $exists: false } },
        { courseTypeKey: null },
        { courseTypeKey: '' },
      ],
    },
    { _id: 1, courseType: 1 }
  ).lean();

  if (!docs.length) return;

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const courseTypeKey = normalizeCourseTypeKey(doc.courseType);
    try {
      const result = await Workload.updateOne(
        { _id: doc._id },
        { $set: { courseTypeKey } }
      );
      if (result.modifiedCount > 0) updated += 1;
    } catch (err) {
      // If this collides with the DE unique index, keep the row unchanged and continue.
      if (Number(err?.code) === 11000) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  console.log(`ℹ️  Workload courseTypeKey backfill: updated=${updated}, skipped=${skipped}`);
};

// ── App ────────────────────────────────────────────────────
const app  = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ── Global middleware ──────────────────────────────────────
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const baselineAllowedOrigins = [
  // HTTPS (production secure)
  'https://faculty-workload-management-cse-client.onrender.com',
  'https://faculty-workload-management.onrender.com',
  'https://wlm-client.onrender.com',
  'https://faculty-workload-management-1.onrender.com',
  'https://160.187.169.41',
  'http://160.187.169.41',
  'http://160.187.169.41:3000',
  'https://160.187.169.41:3000',
  // Local development (localhost for testing)
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'https://localhost:3000',
  'https://localhost:3001',
  'https://localhost:3002',
  'https://localhost:3003',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'https://127.0.0.1:3000',
  'https://127.0.0.1:3001',
  'https://127.0.0.1:3002',
  'https://127.0.0.1:3003',
  // Local network development (192.168.x.x)
  'http://192.168.1.36:3000',
  'http://192.168.1.36:3001',
  'http://192.168.1.36:3002',
  'http://192.168.1.36:3003',
];

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...baselineAllowedOrigins]));

// ── Helmet Security Middleware ────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', process.env.NODE_ENV === 'production' ? 'https:' : 'http:'],
      connectSrc: ["'self'", process.env.NODE_ENV === 'production' ? 'https:' : 'http:'],
    },
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: { policy: 'no-referrer' },
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Allow all local network development IPs (192.168.x.x) in development
    if (process.env.NODE_ENV !== 'production' && origin?.match(/^https?:\/\/192\.168\.\d+\.\d+:\d+$/)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.set('trust proxy', 1);

// ── HTTPS Enforcement Middleware (Production) ──────────────────────
// Redirect HTTP to HTTPS and enforce secure headers
if (process.env.NODE_ENV === 'production') {
  // Redirect HTTP to HTTPS
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(301, `https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
  
  // Add HSTS (HTTP Strict Transport Security) header
  app.use(helmet.hsts({
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());
app.use(xss());
app.use(morgan('dev'));

// ── Rate Limiting ──────────────────────────────────────────
// Initialize Redis for distributed rate limiting (optional, falls back to memory)
initializeRedis().catch((err) => {
  console.warn('Redis initialization failed, using memory-based rate limiting:', err.message);
});

// Apply general API limiter to all /deva/ routes
app.use('/deva/', apiLimiter);

// Prevent client-side caching of all API responses
app.use('/deva/', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Apply strict limiter to sensitive write operations
app.use('/deva/workloads', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return strictLimiter(req, res, next);
  }
  next();
});

app.use('/deva/faculty', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return strictLimiter(req, res, next);
  }
  next();
});

// ── Health check ───────────────────────────────────────────
app.get('/deva/health', (_req, res) => {
  res.json({
    success: true,
    message: 'WLM API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(compression());

// ── API routes ─────────────────────────────────────────────
app.use('/deva/auth',                  authRoutes);
app.use('/deva/designations',          designationsRoutes);
app.use('/deva/faculty',               facultyRoutes);
app.use('/deva/courses',               coursesRoutes);
app.use('/deva/submissions',           submissionsRoutes);
app.use('/deva/workloads',             workloadsRoutes);
app.use('/deva/settings',              settingsRoutes);
app.use('/deva/sections',              require('./routes/sections'));
app.use('/deva/stats',                 statsRoutes);
app.use('/deva/allocations',           allocationsRoutes);
app.use('/deva/audit-logs',            auditLogsRoutes);
app.use('/deva/faculty-preferences',   facultyPreferencesRoutes);
app.use('/deva/faculty',               facultyCapacityRoutes);

// ── 404 handler ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler ───────────────────────────────────
app.use(errorHandler);

// ── Process-level crash guards ────────────────────────────
// Prevent unhandled rejections / exceptions from silently killing the process
// (which would drop all in-flight HTTP connections with ERR_CONNECTION_CLOSED)
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  // Give active requests ~2 s to complete before exiting
  setTimeout(() => process.exit(1), 2000).unref();
});

// ── Start — connect to MongoDB first, then listen ──────────
(async () => {
  await connect();

  const dropIndexSafe = async (model, indexName) => {
    try {
      await model.collection.dropIndex(indexName);
    } catch (dropErr) {
      if (!String(dropErr?.message || '').includes('index not found')) throw dropErr;
    }
  };

  const syncIndexesSafe = async (model) => {
    try {
      await model.syncIndexes();
    } catch (err) {
      const isIndexOptionsConflict = Number(err?.code) === 85;
      const errMsg = String(err?.message || '');

      if (isIndexOptionsConflict && model?.modelName === 'PasswordResetToken' && errMsg.includes('expiresAt_1')) {
        await dropIndexSafe(model, 'expiresAt_1');
        await model.syncIndexes();
        return;
      }

      // Old DE index (no facultyRole filter) conflicts with new Main-Faculty-only index.
      if (isIndexOptionsConflict && model?.modelName === 'Workload') {
        await dropIndexSafe(model, 'uniq_de_per_section_upto_third_year');
        await model.syncIndexes();
        return;
      }

      throw err;
    }
  };

  await syncIndexesSafe(Workload);
  await syncIndexesSafe(Course);
  await syncIndexesSafe(CourseAllocation);
  await syncIndexesSafe(Counter);
  await syncIndexesSafe(AuditLog);
  await syncIndexesSafe(PasswordResetToken);
  await backfillWorkloadCourseTypeKeys();

  // Ensure default settings exist
  await Setting.findOneAndUpdate(
    { key: 'workloadCalculation' },
    { $setOnInsert: { key: 'workloadCalculation', value: 'auto' } },
    { upsert: true }
  );
  
  // Auto-repair missing auth records and initialize roles/designations
  await syncAuthAndRBAC();

  console.log('✅  App initialized successfully.');

  await Setting.findOneAndUpdate(
    { key: 'form_enabled' },
    { $setOnInsert: { key: 'form_enabled', value: 'true' } },
    { upsert: true }
  );

  await Setting.findOneAndUpdate(
    { key: 'sections_config' },
    { $setOnInsert: { key: 'sections_config', value: JSON.stringify(DEFAULT_SECTIONS) } },
    { upsert: true }
  );

  // Server runs on HTTP (Nginx handles SSL termination in production)
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`\n✅  WLM Server running on http://localhost:${PORT}`);
    console.log(`   Auth:        POST http://localhost:${PORT}/deva/auth/login`);
    console.log(`   Faculty:     GET  http://localhost:${PORT}/deva/faculty`);
    console.log(`   Courses:     GET  http://localhost:${PORT}/deva/courses`);
    console.log(`   Submissions: GET  http://localhost:${PORT}/deva/submissions`);
    console.log(`   Workloads:   GET  http://localhost:${PORT}/deva/workloads`);
    console.log(`   Stats:       GET  http://localhost:${PORT}/deva/stats`);
    console.log(`   Health:      GET  http://localhost:${PORT}/deva/health`);
    console.log(`   WebSocket:   WS   ws://localhost:${PORT}/ws\n`);

    // Initialize WebSocket server
    WebSocketHandler.initialize(server);
  });

  // Render's load balancer holds connections for 75 s+; Node defaults to 5 s,
  // which makes Render send requests on already-closed sockets → ERR_CONNECTION_CLOSED.
  // Setting these higher than Render's timeout prevents that race condition.
  server.keepAliveTimeout = 120000; // 120 s
  server.headersTimeout   = 125000; // must be > keepAliveTimeout

  // ── Graceful shutdown (Render sends SIGTERM before container recycle) ──────
  const gracefulShutdown = (signal) => {
    console.log(`\n⚠️  ${signal} received. Closing servers…`);
    
    // Close WebSocket server first
    WebSocketHandler.close();
    
    // Then close HTTP server
    server.close(() => {
      console.log('✅  Servers closed.');
      process.exit(0);
    });
    
    // Force-exit after 15 s if connections don't drain
    setTimeout(() => {
      console.error('❌  Forced exit after timeout.');
      process.exit(1);
    }, 15000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
})();

module.exports = app;

