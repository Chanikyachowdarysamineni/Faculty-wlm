/**
 * Centralized Route Configuration for WLM Application
 * React Router v6
 */

import React, { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import LoadingIndicator from './LoadingIndicator';

// Lazy load page components
const LoginPageComponent = lazy(() => import('./LoginPage'));
const Dashboard = lazy(() => import('./Dashboard'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const CourseWiseWorkloadPage = lazy(() => import('./CourseWiseWorkloadPage'));
const CourseLoadsPage = lazy(() => import('./CourseLoadsPage'));

import { useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';

/**
 * LoginPage Wrapper - Injects onLogin from context
 * Redirects based on role: admins to /admin-dashboard, others to /
 */
const LoginPageWrapper = () => {
  const { currentUser, onLogin } = useAuth();
  
  if (currentUser) {
    if (currentUser.role === 'admin' || currentUser.role === 'Admin') {
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

const DashboardWrapper = () => {
  const { currentUser, onLogout, remainingSeconds } = useAuth();
  return (
    <Suspense fallback={<LoadingIndicator message="Loading dashboard..." />}>
      <Dashboard user={currentUser} onLogout={onLogout} remainingSeconds={remainingSeconds} />
    </Suspense>
  );
};

const AdminDashboardWrapper = () => {
  const { currentUser } = useAuth();
  
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'Admin')) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Suspense fallback={<LoadingIndicator message="Loading admin dashboard..." />}>
      <AdminDashboard />
    </Suspense>
  );
};

const CourseWiseWorkloadPageWrapper = () => {
  return (
    <Suspense fallback={<LoadingIndicator message="Loading course wise workload..." />}>
      <CourseWiseWorkloadPage />
    </Suspense>
  );
};

const CourseLoadsPageWrapper = () => {
  return (
    <Suspense fallback={<LoadingIndicator message="Loading course loads..." />}>
      <CourseLoadsPage />
    </Suspense>
  );
};

export const publicRoutes = [
  { path: '/login', element: <LoginPageWrapper />, title: 'Login' },
  { path: '/', element: <Navigate to="/login" replace />, title: 'Home' },
];

export const protectedRoutes = [
  { path: '/', element: <ProtectedRoute><DashboardWrapper /></ProtectedRoute>, title: 'Dashboard' },
  { path: '/dashboard', element: <ProtectedRoute><DashboardWrapper /></ProtectedRoute>, title: 'Dashboard' },
  { path: '/admin-dashboard', element: <ProtectedRoute roles={['admin']}><AdminDashboardWrapper /></ProtectedRoute>, title: 'Admin Dashboard' },
  { path: '/course-wise-workload', element: <ProtectedRoute><CourseWiseWorkloadPageWrapper /></ProtectedRoute>, title: 'Course Wise Workload Details' },
  { path: '/course-loads', element: <ProtectedRoute><CourseLoadsPageWrapper /></ProtectedRoute>, title: 'Course Loads' }
];

export const allRoutes = [...publicRoutes, ...protectedRoutes];

export const getRouteTitle = (path) => {
  const route = allRoutes.find(r => r.path === path);
  return route ? route.title : 'WLM';
};

export default allRoutes;

