import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import API from './config';
import ErrorBoundary from './ErrorBoundary';
import ToastProvider from './Toast';
import LoadingProvider from './LoadingIndicator';
import { DataProvider } from './DataContext';
import { AuthProvider } from './AuthContext';
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

const SESSION_TIMEOUT_SECONDS = 30 * 60;
const WARNING_THRESHOLD_SECONDS = 2 * 60;

/**
 * AppContent Component
 * 
 * Renders the appropriate routes and UI based on authentication status
 * Displays session timeout warnings for authenticated users
 */
function AppContent({
  currentUser,
  onLogout,
  onLogin,
  remainingSeconds,
  resetSessionTimeout,
  showTimeoutWarning,
  setShowTimeoutWarning,
}) {
  if (currentUser) {
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <>
        {showTimeoutWarning && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #f59e0b',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '420px',
            minWidth: '280px',
            zIndex: 10000,
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            animation: 'slideInRight 0.3s ease-out',
          }}>
            <style>{`
              @keyframes slideInRight {
                from {
                  opacity: 0;
                  transform: translateX(400px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
              }
              .timeout-pulse {
                animation: pulse 1.5s ease-in-out infinite;
              }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <span style={{ fontSize: '28px', lineHeight: '1' }} className="timeout-pulse">⏱️</span>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#b45309', fontSize: '16px', display: 'block', marginBottom: '8px' }}>
                  ⚠️ Session Timeout Warning
                </strong>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#92400e', lineHeight: '1.4' }}>
                  Your session will expire in <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatTime(remainingSeconds)}</span> due to inactivity.
                </p>
                <p style={{ margin: '0', fontSize: '12px', color: '#a16207', fontStyle: 'italic' }}>
                  Move your mouse, press a key, or click the button below to stay logged in.
                </p>
                <button
                  onClick={() => resetSessionTimeout()}
                  style={{
                    marginTop: '12px',
                    background: '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#d97706';
                    e.target.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f59e0b';
                    e.target.style.transform = 'scale(1)';
                  }}
                >
                  ✓ Stay Logged In
                </button>
              </div>
            </div>
          </div>
        )}
        <Routes>
          {protectedRoutes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
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
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_TIMEOUT_SECONDS);
  
  const sessionTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const sessionStartRef = useRef(null);

  const handleLogin = useCallback((user) => {
    localStorage.setItem('wlm_user', JSON.stringify(user));
    setCurrentUser(user);
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
  }, []);

  const handleLogout = useCallback(async () => {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

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
    setShowTimeoutWarning(false);
    setRemainingSeconds(SESSION_TIMEOUT_SECONDS);
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    let timeLeft = SESSION_TIMEOUT_SECONDS;
    setRemainingSeconds(timeLeft);

    countdownRef.current = setInterval(() => {
      timeLeft--;
      setRemainingSeconds(timeLeft);

      if (timeLeft === WARNING_THRESHOLD_SECONDS) {
        setShowTimeoutWarning(true);
      }

      if (timeLeft <= 0) {
        clearInterval(countdownRef.current);
        handleLogout();
      }
    }, 1000);
  }, [handleLogout]);

  const resetSessionTimeout = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    if (timeSinceLastActivity < 3000) return;

    lastActivityRef.current = now;
    setShowTimeoutWarning(false);

    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    startCountdown();
  }, [startCountdown]);

  useEffect(() => {
    if (!currentUser) {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    lastActivityRef.current = Date.now();
    sessionStartRef.current = Date.now();
    setShowTimeoutWarning(false);
    startCountdown();

    return () => {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [currentUser, startCountdown]);

  useEffect(() => {
    if (!currentUser) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetSessionTimeout();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [currentUser, resetSessionTimeout]);

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
            remainingSeconds={remainingSeconds}
            resetSessionTimeout={resetSessionTimeout}
          >
            <ToastProvider>
              <LoadingProvider>
                <AppContent 
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onLogin={handleLogin}
                  remainingSeconds={remainingSeconds}
                  resetSessionTimeout={resetSessionTimeout}
                  showTimeoutWarning={showTimeoutWarning}
                  setShowTimeoutWarning={setShowTimeoutWarning}
                />
              </LoadingProvider>
            </ToastProvider>
          </AuthProvider>
        </DataProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;

