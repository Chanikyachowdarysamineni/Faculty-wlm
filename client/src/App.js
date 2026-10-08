import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import API from './config';
import ErrorBoundary from './ErrorBoundary';
import ToastProvider from './Toast';
import LoadingProvider from './LoadingIndicator';
import { DataProvider } from './DataContext';
import { AuthProvider } from './AuthContext';
import { AcademicPeriodProvider } from './AcademicPeriodContext';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import { publicRoutes, protectedRoutes } from './routes';

// Restore a previously saved session (token and user payload saved at login)
function loadSavedUser() {
  try {
    const token = localStorage.getItem('wlm_token');
    const raw   = localStorage.getItem('wlm_user');
    if (!token || !raw) return null;
    const user = JSON.parse(raw);
    if (!user?.id || !user?.role) {
      localStorage.removeItem('wlm_token');
      localStorage.removeItem('wlm_user');
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

function AppContent({
  currentUser,
}) {
  if (currentUser) {
    return (
      <Routes>
        {protectedRoutes.map((route, index) => (
          <Route key={index} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {publicRoutes.map((route, index) => (
        <Route key={index} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  // Move user state to App level so it persists across routes
  const [currentUser, setCurrentUser] = useState(loadSavedUser);

  const handleLogin = useCallback((user) => {
    localStorage.setItem('wlm_user', JSON.stringify(user));
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const token = localStorage.getItem('wlm_token');
      if (token) {
        await fetch(`${API}/deva/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Logout API call failed:', err);
    }
    
    localStorage.removeItem('wlm_token');
    localStorage.removeItem('wlm_user');
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener('wlm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('wlm:unauthorized', onUnauthorized);
  }, [handleLogout]);

  return (
    <Router basename="/csefaculty">
      <ErrorBoundary>
        <DataProvider>
          <AuthProvider 
            currentUser={currentUser}
            onLogout={handleLogout}
            onLogin={handleLogin}
          >
            <AcademicPeriodProvider currentUser={currentUser}>
              <ToastProvider>
                <LoadingProvider>
                  <AppContent 
                    currentUser={currentUser}
                  />
                </LoadingProvider>
              </ToastProvider>
            </AcademicPeriodProvider>
          </AuthProvider>
        </DataProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
