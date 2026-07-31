/**
 * Centralized Route Configuration for WLM Application
 * React Router v6
 * 
 * This file defines all application routes in a scalable, maintainable structure.
 * Import this in App.js and use with the Routes component.
 */

import React, { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import LoadingIndicator from './LoadingIndicator';

// Lazy load page components
const LoginPageComponent = lazy(() => import('./LoginPage'));
const Dashboard = lazy(() => import('./Dashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const FacultyPage = lazy(() => import('./FacultyPage'));
const CoursesPage = lazy(() => import('./CoursesPage'));
const WorkloadPage = lazy(() => import('./WorkloadPage'));
const MyWorkloadPage = lazy(() => import('./MyWorkloadPage'));
const AllocationPage = lazy(() => import('./AllocationPage'));
const SectionManagementPage = lazy(() => import('./SectionManagementPage'));
const ProfilePage = lazy(() => import('./ProfilePage'));
const MySubmissionsPage = lazy(() => import('./MySubmissionsPage'));
const ExtraFacultyPage = lazy(() => import('./ExtraFacultyPage'));
const AuditLogPage = lazy(() => import('./AuditLogPage'));

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
  
  return (
    <Suspense fallback={<LoadingIndicator message="Loading login..." />}>
      <LoginPageComponent onLogin={onLogin} />
    </Suspense>
  );
};

/**
 * Dashboard Wrapper - Injects user, onLogout, and remainingSeconds from context
 */
const DashboardWrapper = () => {
  const { currentUser, onLogout, remainingSeconds } = useAuth();
  return (
    <Suspense fallback={<LoadingIndicator message="Loading dashboard..." />}>
      <Dashboard user={currentUser} onLogout={onLogout} remainingSeconds={remainingSeconds} />
    </Suspense>
  );
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
  
  return (
    <Suspense fallback={<LoadingIndicator message="Loading admin dashboard..." />}>
      <AdminDashboard />
    </Suspense>
  );
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
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading faculty..." />}><FacultyPage /></Suspense></ProtectedRoute>,
    title: 'Faculty Management'
  },
  {
    path: '/courses',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading courses..." />}><CoursesPage /></Suspense></ProtectedRoute>,
    title: 'Courses Management'
  },
  {
    path: '/workload',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading workload..." />}><WorkloadPage /></Suspense></ProtectedRoute>,
    title: 'Workload Management'
  },
  {
    path: '/my-workload',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading my workload..." />}><MyWorkloadPage /></Suspense></ProtectedRoute>,
    title: 'My Workload'
  },
  {
    path: '/allocations',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading allocations..." />}><AllocationPage /></Suspense></ProtectedRoute>,
    title: 'Allocations'
  },
  {
    path: '/sections',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading sections..." />}><SectionManagementPage /></Suspense></ProtectedRoute>,
    title: 'Section Management'
  },
  {
    path: '/profile',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading profile..." />}><ProfilePage /></Suspense></ProtectedRoute>,
    title: 'Profile'
  },
  {
    path: '/submissions',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading submissions..." />}><MySubmissionsPage /></Suspense></ProtectedRoute>,
    title: 'Submissions'
  },
  {
    path: '/extra-faculty',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading extra faculty..." />}><ExtraFacultyPage /></Suspense></ProtectedRoute>,
    title: 'Extra Faculty'
  },
  {
    path: '/audit-logs',
    element: <ProtectedRoute><Suspense fallback={<LoadingIndicator message="Loading logs..." />}><AuditLogPage /></Suspense></ProtectedRoute>,
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

