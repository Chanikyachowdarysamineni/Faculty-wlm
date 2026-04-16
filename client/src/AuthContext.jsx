/**
 * Authentication and Session Management Context
 * 
 * Provides user authentication state, session timeout handling, and logout functionality
 * to all components in the application.
 */

import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

/**
 * AuthProvider Component
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @param {Object} props.currentUser - Current authenticated user
 * @param {Function} props.onLogout - Logout handler
 * @param {Function} props.onLogin - Login handler
 * @param {number} props.remainingSeconds - Session timeout remaining seconds
 * @param {Function} props.resetSessionTimeout - Function to reset session timeout
 */
export const AuthProvider = ({ 
  children, 
  currentUser, 
  onLogout,
  onLogin,
  remainingSeconds,
  resetSessionTimeout 
}) => {
  const value = {
    currentUser,
    onLogout,
    onLogin,
    remainingSeconds,
    resetSessionTimeout,
    isAuthenticated: !!currentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * 
 * Access authentication context in any component
 * 
 * @returns {Object} Authentication context
 * @returns {Object} currentUser - Current authenticated user or null
 * @returns {Function} onLogout - Function to logout
 * @returns {Function} onLogin - Function to login
 * @returns {number} remainingSeconds - Session timeout remaining seconds
 * @returns {Function} resetSessionTimeout - Function to reset session timeout
 * @returns {boolean} isAuthenticated - Whether user is authenticated
 * 
 * @example
 * const { currentUser, onLogout, isAuthenticated, onLogin } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

