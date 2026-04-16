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

// List of employee IDs that should have admin access
// These IDs are checked server-side during login
const ADMIN_EMPLOYEE_IDS = [
  '189',  // Admin user 1
  '675',  // Admin user 2
];

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
