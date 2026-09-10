'use strict';

const SystemConfig = require('../models/SystemConfig');
const logger = require('./logger');

let cachedConfig = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default seed values for migration
const DEFAULT_CONFIG = {
  singletonFlag: 'config',
  years: [
    { value: 'I', label: 'I Year', isActive: true },
    { value: 'II', label: 'II Year', isActive: true },
    { value: 'III', label: 'III Year', isActive: true },
    { value: 'IV', label: 'IV Year', isActive: true },
    { value: 'M.Tech', label: 'M.Tech', isActive: true },
    { value: 'Other', label: 'Other', isActive: true }
  ],
  courseTypes: [
    { value: 'Mandatory', label: 'Mandatory', isActive: true },
    { value: 'Department Elective', label: 'Department Elective', isActive: true },
    { value: 'Open Elective', label: 'Open Elective', isActive: true },
    { value: 'Minors', label: 'Minors', isActive: true },
    { value: 'Honours', label: 'Honours', isActive: true }
  ],
  facultyRoles: [
    { value: 'Main Faculty', label: 'Main Faculty', isActive: true },
    { value: 'Supporting Faculty', label: 'Supporting Faculty', isActive: true },
    { value: 'TA', label: 'TA', isActive: true }
  ],
  designations: [
    { value: 'Professor', label: 'Professor', isActive: true },
    { value: 'Associate Professor', label: 'Associate Professor', isActive: true },
    { value: 'Assistant Professor', label: 'Assistant Professor', isActive: true },
    { value: 'Teaching Assistant', label: 'Teaching Assistant', isActive: true }
  ],
  departments: [
    { value: 'CSE', label: 'CSE', isActive: true }
  ]
};

/**
 * Ensures the config exists in the DB, and caches it.
 */
const refreshConfig = async () => {
  try {
    let config = await SystemConfig.findOne({ singletonFlag: 'config' }).lean();
    
    // Seed if it doesn't exist
    if (!config) {
      logger.info('SystemConfig not found. Seeding default configuration...');
      await SystemConfig.create(DEFAULT_CONFIG);
      config = await SystemConfig.findOne({ singletonFlag: 'config' }).lean();
    }
    
    cachedConfig = config;
    lastFetch = Date.now();
    return cachedConfig;
  } catch (err) {
    logger.error('Failed to refresh SystemConfig', { error: err.message });
    // If DB fails, fallback to cached or default
    return cachedConfig || DEFAULT_CONFIG;
  }
};

/**
 * Gets the config from cache or DB if stale.
 */
const getConfig = async () => {
  if (!cachedConfig || Date.now() - lastFetch > CACHE_TTL) {
    await refreshConfig();
  }
  return cachedConfig;
};

/**
 * Validates if a value exists in a specific config list.
 * @param {string} listName - e.g., 'years', 'courseTypes'
 * @param {string} value - The value to validate
 * @param {boolean} activeOnly - If true, only checks items where isActive === true
 * @returns {boolean}
 */
const isValidConfigValue = async (listName, value, activeOnly = false) => {
  if (!value) return false;
  const config = await getConfig();
  const list = config[listName] || [];
  
  // Normalize string for case-insensitive matching
  const normalizedValue = String(value).trim().toLowerCase();
  
  return list.some(item => {
    if (activeOnly && !item.isActive) return false;
    return String(item.value).trim().toLowerCase() === normalizedValue;
  });
};

module.exports = {
  refreshConfig,
  getConfig,
  isValidConfigValue,
  DEFAULT_CONFIG
};
