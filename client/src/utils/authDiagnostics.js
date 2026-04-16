/**
 * Authentication Diagnostics
 * 
 * Helper functions to debug authentication issues
 */

/**
 * Check current authentication status
 * @returns {Object} Authentication status
 */
export const checkAuthStatus = () => {
  const token = localStorage.getItem('wlm_token');
  const user = localStorage.getItem('wlm_user');
  
  return {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenIsEmpty: token === '' || token === null,
    hasUser: !!user,
    userObj: user ? JSON.parse(user) : null,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Log authentication diagnostics to console
 */
export const logAuthDiagnostics = () => {
  const status = checkAuthStatus();
  console.group('[AUTH DIAGNOSTICS]');
  console.log('Token present:', status.hasToken);
  console.log('Token length:', status.tokenLength);
  console.log('User present:', status.hasUser);
  if (status.userObj) {
    console.log('User ID:', status.userObj.id);
    console.log('User role:', status.userObj.role);
  }
  console.log('Full status:', status);
  console.groupEnd();
};

/**
 * Get Authorization header for debugging
 * @returns {string} Authorization header value
 */
export const getAuthHeaderForDebug = () => {
  const token = localStorage.getItem('wlm_token');
  return `Bearer ${token || '[EMPTY]'}`;
};

export default {
  checkAuthStatus,
  logAuthDiagnostics,
  getAuthHeaderForDebug,
};
