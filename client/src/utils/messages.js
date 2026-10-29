/**
 * Centralized messages and error formatting module for the frontend.
 * Provides consistent, professional, and actionable notifications across all modules.
 */

export const MESSAGES = {
  // Generic & Network
  NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection and verify the server is running.',
  TIMEOUT_ERROR: 'The server took too long to respond. Please try again in a moment.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact the administrator.',
  UNAUTHORIZED: 'Your session has expired. Please log in again to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested record could not be found.',
  DUPLICATE_RECORD: 'A record with this information already exists. Please check for duplicate entries.',

  // Common CRUD Actions
  SAVE_SUCCESS: 'Saved successfully.',
  UPDATE_SUCCESS: 'Updated successfully.',
  DELETE_SUCCESS: 'Deleted successfully.',
  RESTORE_SUCCESS: 'Restored successfully.',
  ORDER_SAVED: 'Display order saved successfully.',
  DELETE_CONFIRM: 'Are you sure you want to delete this record? This action cannot be undone.',

  // Workload Management
  WORKLOAD_ASSIGN_SUCCESS: 'Workload assigned successfully.',
  WORKLOAD_UPDATE_SUCCESS: 'Workload updated successfully.',
  WORKLOAD_DELETE_SUCCESS: 'Workload assignment removed successfully.',
  WORKLOAD_DUPLICATE_CONFLICT: 'This course is already allocated for the selected section and academic context.',
  CAPACITY_EXCEEDED: 'The proposed assignment exceeds the faculty member\'s remaining workload capacity.',
  TA_ROLE_RESTRICTION: 'Teaching Assistants can only be assigned to TA roles (R2, R3, R4) with practical/tutorial hours.',

  // Course Management
  COURSE_SAVE_SUCCESS: 'Course saved successfully.',
  COURSE_UPDATE_SUCCESS: 'Course updated successfully.',
  COURSE_DELETE_SUCCESS: 'Course deleted successfully.',
  COURSE_CODE_DUPLICATE: 'A course with this subject code already exists for this program, academic year, and semester.',

  // Faculty Management
  FACULTY_SAVE_SUCCESS: 'Faculty member added successfully.',
  FACULTY_UPDATE_SUCCESS: 'Faculty details updated successfully.',
  FACULTY_DELETE_SUCCESS: 'Faculty record deleted successfully.',
  FACULTY_EMPID_DUPLICATE: 'A faculty member with this Employee ID already exists.',
  FACULTY_RELIEVED_DATE_INVALID: 'Relieving date cannot be earlier than joining date.',

  // Forms & Field Validation
  REQUIRED_FIELD: 'This field is required.',
  VALIDATION_FAILED: 'Please correct the highlighted form errors before submitting.',
  INVALID_MOBILE: 'Mobile number must be exactly 10 digits.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_EMPID: 'Please enter a valid Employee ID.',
  INVALID_HOURS: 'Hours must be a non-negative number.',

  // Bulk Actions
  BULK_SAVE_SUCCESS: (savedCount) => `Saved ${savedCount} records successfully.`,
  BULK_SAVE_PARTIAL: (savedCount, failedCount) => `Saved ${savedCount} records, but ${failedCount} encountered errors.`,
};

/**
 * Format any API response data, network exception, or error object into a clean,
 * actionable, user-friendly message.
 *
 * @param {any} errOrData - Response data or Error object
 * @param {string} [fallbackMessage] - Default fallback message
 * @returns {string} Sanitized user-friendly error message
 */
export const formatApiError = (errOrData, fallbackMessage = MESSAGES.UNKNOWN_ERROR) => {
  if (!errOrData) return fallbackMessage;

  // Handle AbortError / Timeout
  if (errOrData.name === 'AbortError' || String(errOrData.message || '').includes('aborted') || String(errOrData.message || '').includes('timeout')) {
    return MESSAGES.TIMEOUT_ERROR;
  }

  // Handle Network / Connection Offline
  if (errOrData instanceof TypeError && String(errOrData.message).toLowerCase().includes('failed to fetch')) {
    return MESSAGES.NETWORK_ERROR;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return MESSAGES.NETWORK_ERROR;
  }

  // Handle structured API response
  const rawMsg = errOrData.message || (typeof errOrData === 'string' ? errOrData : '');

  // Sanitize raw technical or stack messages
  if (!rawMsg || rawMsg.includes('Internal Server Error') || rawMsg.includes('is not defined') || rawMsg.includes('MongoError')) {
    if (errOrData.correlationId) {
      return `An unexpected error occurred. Please try again or contact support (Ref: ${errOrData.correlationId}).`;
    }
    return fallbackMessage;
  }

  return rawMsg;
};

/**
 * Extract field-specific errors into a key-value map for inline form validation.
 * Supports express-validator format and Mongoose validation errors.
 *
 * @param {any} apiResponse - Response data from API
 * @returns {Record<string, string>} Map of field names to error messages
 */
export const extractFieldErrors = (apiResponse) => {
  const fieldErrors = {};
  if (!apiResponse) return fieldErrors;

  const errors = apiResponse.errors;
  if (Array.isArray(errors)) {
    errors.forEach((err) => {
      if (typeof err === 'string') {
        fieldErrors._form = err;
      } else if (err && typeof err === 'object') {
        const fieldName = err.field || err.path || err.param;
        const errorMsg = err.message || err.msg || 'Invalid value';
        if (fieldName) {
          fieldErrors[fieldName] = errorMsg;
        } else {
          fieldErrors._form = errorMsg;
        }
      }
    });
  } else if (typeof errors === 'object' && errors !== null) {
    Object.entries(errors).forEach(([field, msg]) => {
      fieldErrors[field] = typeof msg === 'string' ? msg : (msg?.message || 'Invalid value');
    });
  }

  return fieldErrors;
};
