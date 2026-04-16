/**
 * Centralized Route Configuration for WLM Application
 * React Router v6
 * 
 * This file defines all application routes in a scalable, maintainable structure.
 * Import this in App.js and use with the Routes component.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';

// Import page components
import LoginPageComponent from './LoginPage';
import Dashboard from './Dashboard';
import AdminDashboard from './AdminDashboard';
import FacultyPage from './FacultyPage';
import CoursesPage from './CoursesPage';
import WorkloadPage from './WorkloadPage';
import MyWorkloadPage from './MyWorkloadPage';
import AllocationPage from './AllocationPage';
import SectionManagementPage from './SectionManagementPage';
import ProfilePage from './ProfilePage';
import MySubmissionsPage from './MySubmissionsPage';
import ExtraFacultyPage from './ExtraFacultyPage';
import AuditLogPage from './AuditLogPage';
import CapacityManagementPage from './CapacityManagementPage';
import { useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';

/**
 * LoginPage Wrapper - Injects onLogin from context
 * Redirects based on role: admins to /admin-dashboard, others to /
 */
const LoginPageWrapper = () => {
  const { currentUser, onLogin } = useAuth();
  
  // Redirect based on role if already logged in
  if (currentUser) {
    if (currentUser.role === 'admin') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return <LoginPageComponent onLogin={onLogin} />;
};

/**
 * Dashboard Wrapper - Injects user, onLogout, and remainingSeconds from context
 */
const DashboardWrapper = () => {
  const { currentUser, onLogout, remainingSeconds } = useAuth();
  return <Dashboard user={currentUser} onLogout={onLogout} remainingSeconds={remainingSeconds} />;
};

/**
 * Admin Dashboard Wrapper - Admin-only dashboard
 * Requires admin role, redirects others to regular dashboard
 */
const AdminDashboardWrapper = () => {
  const { currentUser, onLogout } = useAuth();
  
  // Security: Verify role on frontend (server validates on routes)
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return <AdminDashboard />;
};

/**
 * Public Routes - Accessible without authentication
 */
export const publicRoutes = [
  {
    path: '/login',
    element: <LoginPageWrapper />,
    title: 'Login'
  },
  {
    path: '/',
    element: <Navigate to="/login" replace />,
    title: 'Home'
  },
];

/**
 * Protected Routes - Accessible only to authenticated users
 * These are rendered within the Dashboard layout
 */
export const protectedRoutes = [
  {
    path: '/',
    element: <ProtectedRoute><DashboardWrapper /></ProtectedRoute>,
    title: 'Dashboard'
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><DashboardWrapper /></ProtectedRoute>,
    title: 'Dashboard'
  },
  {
    path: '/admin-dashboard',
    element: <ProtectedRoute roles={['admin']}><AdminDashboardWrapper /></ProtectedRoute>,
    title: 'Admin Dashboard'
  },
  {
    path: '/faculty',
    element: <ProtectedRoute><FacultyPage /></ProtectedRoute>,
    title: 'Faculty Management'
  },
  {
    path: '/courses',
    element: <ProtectedRoute><CoursesPage /></ProtectedRoute>,
    title: 'Courses Management'
  },
  {
    path: '/workload',
    element: <ProtectedRoute><WorkloadPage /></ProtectedRoute>,
    title: 'Workload Management'
  },
  {
    path: '/capacity',
    element: <ProtectedRoute roles={['admin']}><CapacityManagementPage /></ProtectedRoute>,
    title: 'Capacity Management'
  },
  {
    path: '/my-workload',
    element: <ProtectedRoute><MyWorkloadPage /></ProtectedRoute>,
    title: 'My Workload'
  },
  {
    path: '/allocations',
    element: <ProtectedRoute><AllocationPage /></ProtectedRoute>,
    title: 'Allocations'
  },
  {
    path: '/sections',
    element: <ProtectedRoute><SectionManagementPage /></ProtectedRoute>,
    title: 'Section Management'
  },
  {
    path: '/profile',
    element: <ProtectedRoute><ProfilePage /></ProtectedRoute>,
    title: 'Profile'
  },
  {
    path: '/submissions',
    element: <ProtectedRoute><MySubmissionsPage /></ProtectedRoute>,
    title: 'Submissions'
  },
  {
    path: '/extra-faculty',
    element: <ProtectedRoute><ExtraFacultyPage /></ProtectedRoute>,
    title: 'Extra Faculty'
  },
  {
    path: '/audit-logs',
    element: <ProtectedRoute><AuditLogPage /></ProtectedRoute>,
    title: 'Audit Logs'
  },
];

/**
 * All Routes Combined
 */
export const allRoutes = [...publicRoutes, ...protectedRoutes];

/**
 * Get route title by path
 * Useful for dynamic page titles
 */
export const getRouteTitle = (path) => {
  const route = allRoutes.find(r => r.path === path);
  return route ? route.title : 'WLM';
};

export default allRoutes;

