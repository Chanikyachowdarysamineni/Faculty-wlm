/**
 * Centralized messages module for the frontend.
 * Avoid hardcoding generic error/success text in components.
 */
export const MESSAGES = {
  // Generic
  NETWORK_ERROR: 'Cannot reach the server. Please check your connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  
  // Forms & Validation
  REQUIRED_FIELD: 'This field is required.',
  INVALID_MOBILE: 'Mobile number must be exactly 10 digits.',
  INVALID_EMAIL: 'Enter a valid email address.',
  INVALID_EMPID: 'Employee ID is invalid.',
  
  // Bulk Actions
  BULK_SAVE_SUCCESS: (savedCount) => `Saved ${savedCount} successfully.`,
  BULK_SAVE_PARTIAL: (savedCount, failedCount) => `Saved ${savedCount}, but ${failedCount} failed.`,
  
  // Common Actions
  SAVE_SUCCESS: 'Saved successfully.',
  DELETE_SUCCESS: 'Deleted successfully.',
  DELETE_CONFIRM: 'Are you sure you want to delete this?',
};
