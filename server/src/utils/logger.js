'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log levels with numeric values (lower = more critical)
const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Get current log level value
 * @returns {number}
 */
const getCurrentLevelValue = () => {
  return LEVELS[LOG_LEVEL] !== undefined ? LEVELS[LOG_LEVEL] : LEVELS.info;
};

/**
 * Format log entry as JSON
 * @private
 */
const formatLogEntry = (level, message, metadata = {}) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...metadata,
  });
};

/**
 * Write log entry to file
 * @private
 */
const writeToFile = (level, entry) => {
  try {
    const logFile = path.join(LOG_DIR, `${level}.log`);
    fs.appendFileSync(logFile, entry + '\n', { encoding: 'utf-8' });
  } catch (err) {
    console.error('[Logger] Failed to write to log file:', err.message);
  }
};

/**
 * Core logging function
 * @private
 */
const log = (level, message, metadata = {}) => {
  // Skip if below current log level
  if (LEVELS[level] > getCurrentLevelValue()) {
    return;
  }

  const entry = formatLogEntry(level, message, metadata);

  // Console output
  const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[consoleMethod](entry);

  // File output
  writeToFile(level, entry);

  // Also write errors to error.log even if level is lower
  if (level === 'error') {
    writeToFile('error', entry);
  }
};

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {object} metadata - Additional metadata (error, stack, etc.)
 * @example
 * logger.error('Database connection failed', { error: err.message, code: 'DB_CONN_ERR' });
 */
const error = (message, metadata = {}) => {
  log('error', message, metadata);
};

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {object} metadata - Additional metadata
 * @example
 * logger.warn('Slow query detected', { duration: 5000 });
 */
const warn = (message, metadata = {}) => {
  log('warn', message, metadata);
};

/**
 * Log an info message
 * @param {string} message - Info message
 * @param {object} metadata - Additional metadata
 * @example
 * logger.info('User logged in', { userId: 'EMP001', timestamp: new Date() });
 */
const info = (message, metadata = {}) => {
  log('info', message, metadata);
};

/**
 * Log a debug message (only in development)
 * @param {string} message - Debug message
 * @param {object} metadata - Additional metadata
 * @example
 * logger.debug('Processing workload', { empId: 'EMP001', courseId: 101 });
 */
const debug = (message, metadata = {}) => {
  log('debug', message, metadata);
};

/**
 * Log HTTP request information
 * @param {object} req - Express request object
 * @param {string} action - Action description
 * @param {object} metadata - Additional metadata
 * @example
 * logger.logRequest(req, 'workload.create', { empId: 'EMP001' });
 */
const logRequest = (req, action, metadata = {}) => {
  info(`${action}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    ...metadata,
  });
};

/**
 * Log API response
 * @param {object} req - Express request object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Response message
 * @param {object} metadata - Additional metadata
 * @example
 * logger.logResponse(req, 200, 'Workload created', { workloadId: 'mongo_id' });
 */
const logResponse = (req, statusCode, message, metadata = {}) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  log(level, message, {
    method: req.method,
    path: req.path,
    statusCode,
    userId: req.user?.id || 'anonymous',
    ...metadata,
  });
};

/**
 * Get log file statistics
 * @returns {object} Object with file sizes for each log level
 */
const getLogStats = () => {
  const stats = {};
  for (const level of Object.keys(LEVELS)) {
    try {
      const logFile = path.join(LOG_DIR, `${level}.log`);
      if (fs.existsSync(logFile)) {
        const size = fs.statSync(logFile).size;
        stats[level] = {
          file: logFile,
          sizeBytes: size,
          sizeMB: (size / 1024 / 1024).toFixed(2),
        };
      }
    } catch (err) {
      // Ignore errors
    }
  }
  return stats;
};

/**
 * Clear log files (useful for cleanup/testing)
 * @param {string} level - Optional specific level to clear (default: all)
 */
const clearLogs = (level = null) => {
  try {
    if (level && LEVELS[level] !== undefined) {
      const logFile = path.join(LOG_DIR, `${level}.log`);
      if (fs.existsSync(logFile)) {
        fs.truncateSync(logFile);
        info(`Cleared ${level} log file`);
      }
    } else {
      for (const lv of Object.keys(LEVELS)) {
        const logFile = path.join(LOG_DIR, `${lv}.log`);
        if (fs.existsSync(logFile)) {
          fs.truncateSync(logFile);
        }
      }
      info('Cleared all log files');
    }
  } catch (err) {
    error('Failed to clear logs', { error: err.message });
  }
};

module.exports = {
  error,
  warn,
  info,
  debug,
  logRequest,
  logResponse,
  getLogStats,
  clearLogs,
};
