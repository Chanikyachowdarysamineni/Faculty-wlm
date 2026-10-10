'use strict';

/**
 * Centralized messages module for the backend.
 * Avoid hardcoding messages in scattered places.
 */
module.exports = {
  // Common
  INTERNAL_ERROR: 'An internal server error occurred.',
  UNAUTHORIZED: 'Authentication required. Please log in.',
  FORBIDDEN: 'Access denied. You do not have permission to perform this action.',
  NOT_FOUND: (resource) => `${resource} not found.`,
  VALIDATION_FAILED: 'Validation failed',

  // Faculty
  FACULTY_DUPLICATE_EMPID: 'Employee ID already exists.',
  FACULTY_DUPLICATE_EMAIL: 'Email already exists for another faculty member.',
  FACULTY_CREATED: 'Faculty added successfully.',
  FACULTY_UPDATED: 'Faculty updated successfully.',
  FACULTY_DELETED: 'Faculty record deleted successfully.',
  FACULTY_RESTORED: 'Faculty record restored successfully.',
  FACULTY_IMPORT_SUCCESS: (count) => `Import successful. ${count} faculty imported.`,

  // Auth
  OTP_SENT: 'OTP sent to your email.',
  OTP_FAILED: 'Failed to send OTP. Please check your Employee ID and try again.',
  INVALID_OTP: 'Invalid or expired OTP. Please try again.',
  LOGIN_SUCCESS: 'Logged in successfully.',

  // Workload & Allocations
  WORKLOAD_MANUAL_SAVED: 'Manual hours saved successfully.',
  WORKLOAD_DELETE_BLOCKED: (count) => `Cannot delete: ${count} allocations use this course.`,
  ALLOCATION_DUPLICATE: 'Faculty already assigned for this section.',
  
  // Custom Validation Messages
  MOBILE_INVALID: 'Mobile number must be exactly 10 digits',
  EMAIL_INVALID: 'Enter a valid email address',
  EMPID_INVALID: 'Employee ID must be 3-20 characters (alphanumeric, hyphens, underscores, periods, @ allowed)',
  NAME_INVALID: 'Name must be 2-100 characters',
};
