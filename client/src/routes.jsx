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

const DashboardWrapper = ({ initialTab }) => {
  const { currentUser, onLogout, remainingSeconds } = useAuth();
  return (
    <Suspense fallback={<LoadingIndicator message="Loading dashboard..." />}>
      <Dashboard user={currentUser} onLogout={onLogout} remainingSeconds={remainingSeconds} initialTab={initialTab} />
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
  { path: '/reset-password', element: <LoginPageWrapper />, title: 'Reset Password' },
  { path: '/', element: <Navigate to="/login" replace />, title: 'Home' },
];

export const protectedRoutes = [
  { path: '/', element: <ProtectedRoute><DashboardWrapper /></ProtectedRoute>, title: 'Dashboard' },
  { path: '/dashboard', element: <ProtectedRoute><DashboardWrapper initialTab="dashboard" /></ProtectedRoute>, title: 'Dashboard' },
  { path: '/faculty', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="faculty" /></ProtectedRoute>, title: 'Manage Faculty' },
  { path: '/courses', element: <ProtectedRoute><DashboardWrapper initialTab="courses" /></ProtectedRoute>, title: 'Manage Courses' },
  { path: '/workload', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="workload" /></ProtectedRoute>, title: 'Workload Management' },
  { path: '/capacity', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="workload" /></ProtectedRoute>, title: 'Capacity Management' },
  { path: '/allocation', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="allocation" /></ProtectedRoute>, title: 'Course Allocation' },
  { path: '/sections', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="sections" /></ProtectedRoute>, title: 'Section Management' },
  { path: '/academic-years', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="academic-years" /></ProtectedRoute>, title: 'Academic Years' },
  { path: '/settings', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="academic-years" /></ProtectedRoute>, title: 'Settings' },
  { path: '/designations', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="designations" /></ProtectedRoute>, title: 'Manage Designations' },
  { path: '/admin-management', element: <ProtectedRoute roles={['admin']}><DashboardWrapper initialTab="admin-management" /></ProtectedRoute>, title: 'Admin Management' },
  { path: '/facultyform', element: <ProtectedRoute><DashboardWrapper initialTab="facultyform" /></ProtectedRoute>, title: 'Faculty Form' },
  { path: '/mysubmissions', element: <ProtectedRoute><DashboardWrapper initialTab="mysubmissions" /></ProtectedRoute>, title: 'My Submissions' },
  { path: '/myworkload', element: <ProtectedRoute><DashboardWrapper initialTab="myworkload" /></ProtectedRoute>, title: 'My Workload' },
  { path: '/profile', element: <ProtectedRoute><DashboardWrapper initialTab="profile" /></ProtectedRoute>, title: 'Profile' },
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

