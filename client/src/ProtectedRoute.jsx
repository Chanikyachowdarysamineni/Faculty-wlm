/**
 * ProtectedRoute Wrapper Component
 * 
 * Ensures that routes are only accessible to authenticated users.
 * Optionally enforces specific roles.
 * If user is not authenticated or doesn't have required role, redirects to login/dashboard.
 * 
 * @param {React.ReactNode} children - Component to render if authenticated and authorized
 * @param {Array<string>} roles - Optional list of roles required. If not specified, any authenticated user can access.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, currentUser } = useAuth();

  // Not authenticated: redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Roles specified and user doesn't have required role: redirect to dashboard
  if (roles.length > 0 && !roles.includes(currentUser?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;


