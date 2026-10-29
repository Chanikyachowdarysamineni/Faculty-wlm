/**
 * config/adminConfig.js
 * 
 * Centralized admin access configuration
 * ⚠️ SECURITY: Role assignment happens ONLY on backend, not frontend
 * 
 * Database-driven administrator assignments managed via Admin Management.
 * System bootstrap admin account (from environment) prevents system lockout.
 */

'use strict';

// Support admin IDs from environment variable for initial system bootstrap & recovery
const ENV_ADMIN_IDS = (process.env.ADMIN_EMPLOYEE_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const defaultAdminId = (process.env.ADMIN_ID || 'admin').trim();

// Bootstrap / recovery administrator IDs to prevent system lockout
const ADMIN_EMPLOYEE_IDS = Array.from(new Set([
  defaultAdminId,
  ...(ENV_ADMIN_IDS.length > 0 ? ENV_ADMIN_IDS : [])
])).filter(Boolean);

/**
 * Check if an employee ID is a system bootstrap/recovery administrator
 * @param {string} empId - Employee ID to check
 * @returns {boolean} true if employee is bootstrap admin
 */
const isBootstrapAdmin = (empId) => {
  if (!empId) return false;
  const normalizedId = String(empId).trim();
  return ADMIN_EMPLOYEE_IDS.includes(normalizedId);
};

/**
 * Check if an employee ID should have admin access (alias for backward compatibility)
 * @param {string} empId - Employee ID to check
 * @returns {boolean} true if employee is bootstrap admin
 */
const isAdminEmployeeId = (empId) => {
  return isBootstrapAdmin(empId);
};

/**
 * Get admin access info for logging/auditing
 * @returns {Object} Admin configuration info
 */
const getAdminConfig = () => ({
  adminCount: ADMIN_EMPLOYEE_IDS.length,
  adminIds: ADMIN_EMPLOYEE_IDS,
  lastUpdated: new Date().toISOString(),
});

module.exports = {
  ADMIN_EMPLOYEE_IDS,
  isBootstrapAdmin,
  isAdminEmployeeId,
  getAdminConfig,
};
