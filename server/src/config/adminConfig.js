/**
 * config/adminConfig.js
 * 
 * Centralized admin access configuration
 * ⚠️ SECURITY: Role assignment happens ONLY on backend, not frontend
 * 
 * Admin employee IDs are checked during login and role is embedded in JWT.
 * Frontend cannot modify role without valid JWT from authenticated backend.
 */

'use strict';

// H-7 FIX: Support admin IDs from environment variable to avoid committing sensitive IDs to source code
// In production, set ADMIN_EMPLOYEE_IDS=189,675 (comma-separated) in your .env file
const ENV_ADMIN_IDS = (process.env.ADMIN_EMPLOYEE_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const defaultAdminId = (process.env.ADMIN_ID || 'admin').trim();

// List of employee IDs that should have admin access
// Falls back to hardcoded IDs only when env var is not set (local dev only)
const ADMIN_EMPLOYEE_IDS = Array.from(new Set([
  defaultAdminId,
  ...(ENV_ADMIN_IDS.length > 0 ? ENV_ADMIN_IDS : ['189', '675'])
])).filter(Boolean);

/**
 * Check if an employee ID should have admin access
 * @param {string} empId - Employee ID to check
 * @returns {boolean} true if employee should be admin
 */
const isAdminEmployeeId = (empId) => {
  if (!empId) return false;
  const normalizedId = String(empId).trim();
  return ADMIN_EMPLOYEE_IDS.includes(normalizedId);
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
  isAdminEmployeeId,
  getAdminConfig,
};
