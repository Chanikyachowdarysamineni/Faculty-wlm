const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Daily rotate file for general application logs
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
    // Daily rotate file specifically for errors
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Always add Console transport so container / stdout log streams capture application logs
logger.add(
  new winston.transports.Console({
    format: winston.format.combine(
      process.env.NODE_ENV !== 'production' ? winston.format.colorize() : winston.format.uncolorize(),
      winston.format.printf(
        ({ level, message, timestamp, stack }) => `${timestamp} ${level}: ${message}${stack ? '\n' + stack : ''}`
      )
    ),
  })
);

module.exports = logger;
