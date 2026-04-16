import React, { useState } from 'react';
import API from './config';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and Password.');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/deva/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: employeeId.trim(), password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || 'Login failed.');
      } else if (data.data && data.data.token && data.data.user) {
        // Successfully logged in - store token and user info
        localStorage.setItem('wlm_token', data.data.token);
        localStorage.setItem('wlm_user', JSON.stringify(data.data.user));
        console.log('[Auth] Token stored successfully');
        onLogin(data.data.user);
      } else {
        setError('Invalid login response. Please try again.');
      }
    } catch {
      setError('Could not reach server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/deva/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: forgotId.trim() }),
      });  // No auth required for forgot-password
      const data = await res.json();
      setForgotMessage(data.message || 'Reset token has been generated.');
      setResetToken(data.resetToken || '');
    } catch { /* server unreachable — still show success UI */ }
    setForgotSubmitted(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetToken.trim() || !newPassword.trim()) {
      setResetMessage('Please provide reset token and new password.');
      return;
    }
    setResetting(true);
    setResetMessage('');
    try {
      const res = await fetch(`${API}/deva/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword }),
      });  // No auth required for reset-password
      const data = await res.json();
      if (!res.ok || !data.success) {
        setResetMessage(data.message || 'Could not reset password.');
      } else {
        setResetMessage('Password reset successful. You can now log in with the new password.');
      }
    } catch {
      setResetMessage('Network error while resetting password.');
    } finally {
      setResetting(false);
    }
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotId('');
    setForgotSubmitted(false);
    setForgotMessage('');
    setResetToken('');
    setNewPassword('');
    setResetMessage('');
  };

  const [logoLoaded, setLogoLoaded] = useState(false);

  const pub = process.env.PUBLIC_URL || '';
  const wrapperBg = {
    backgroundImage: `url('${pub}/image.webp')`,
  };

  return (
    <div className="wlm-wrapper" style={wrapperBg}>
      <div className="wlm-card">
        {/* Left Panel */}
        <div className="wlm-left">
          {/* Decorative shapes */}
          <span className="shape circle-outline top-right" />
          <span className="shape triangle-outline bottom-left" />
          <span className="shape diamond-outline mid-right" />
          <span className="shape circle-sm bottom-right" />

          <div className="avatar-container">
            <div className="wlm-logo-wrap">
              <img
                src={`${pub}/logo.webp`}
                alt="WLM Logo"
                className={`wlm-logo-img${logoLoaded ? ' wlm-logo-loaded' : ''}`}
                onLoad={() => setLogoLoaded(true)}
                onError={() => console.error('Logo failed to load from:', `${pub}/logo.webp`)}
                fetchpriority="high"
              />
            </div>
            {/* Developer credit below logo */}
            <div className="wlm-dev-credit">
              <span className="wlm-dev-label">✦ Developed by ✦</span>
              <a
                href="https://my-profile-ruby-eta.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="wlm-dev-name"
              >Chanikya Chowdary Samineni</a>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="wlm-right">
          <div className="wlm-site-name">Faculty Work Load Management</div>
          <h2 className="wlm-title">Member Login</h2>

          <form className="wlm-form" onSubmit={handleLogin}>
            {/* Employee ID */}
            <div className="wlm-input-group">
              <span className="wlm-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="wlm-input"
                required
              />
            </div>

            {/* Password */}
            <div className="wlm-input-group">
              <span className="wlm-input-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="wlm-input"
                required
              />
              <button
                type="button"
                className="wlm-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Login Button */}
            <button type="submit" className="wlm-login-btn" disabled={loading}>
              {loading ? 'LOGGING IN…' : 'LOGIN'}
            </button>

            {/* Inline error */}
            {error && <p className="wlm-error">{error}</p>}
          </form>

          {/* Credential hint */}
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textAlign: 'center', margin: '12px 0 0', lineHeight: 1.5 }}>
            Use your <strong style={{ color: 'rgba(255,255,255,0.9)' }}>Employee ID</strong> &amp; registered{' '}
            <strong style={{ color: 'rgba(255,255,255,0.9)' }}>mobile number</strong> as password
          </p>

          <p className="wlm-forgot">
            Forgot{' '}
            <button className="wlm-forgot-link" onClick={() => setShowForgot(true)}>
              Employee ID / Password?
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="wlm-modal-overlay" onClick={closeForgot}>
          <div className="wlm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="wlm-modal-close" onClick={closeForgot}>✕</button>
            <h3 className="wlm-modal-title">Reset Password</h3>
            <p className="wlm-modal-desc">
              Enter your Employee ID to receive a password reset link.
            </p>
            {!forgotSubmitted ? (
              <form onSubmit={handleForgotSubmit}>
                <div className="wlm-input-group">
                  <span className="wlm-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Employee ID"
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    className="wlm-input"
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="wlm-login-btn" style={{ marginTop: '16px', width: '100%' }}>
                  SEND RESET LINK
                </button>
              </form>
            ) : (
              <div className="wlm-modal-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>{forgotMessage || <>Reset request submitted for Employee ID <strong>{forgotId}</strong>.</>}</p>
                <form onSubmit={handleResetPassword} style={{ marginTop: '12px', width: '100%' }}>
                  <div className="wlm-input-group" style={{ marginBottom: '10px' }}>
                    <input
                      type="text"
                      placeholder="Reset token"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="wlm-input"
                      required
                    />
                  </div>
                  <div className="wlm-input-group">
                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="wlm-input"
                      required
                    />
                  </div>
                  <button type="submit" className="wlm-login-btn" style={{ marginTop: '12px', width: '100%' }} disabled={resetting}>
                    {resetting ? 'RESETTING…' : 'RESET PASSWORD'}
                  </button>
                </form>
                {resetMessage && <p style={{ marginTop: '8px', fontSize: '12px' }}>{resetMessage}</p>}
                <button className="wlm-login-btn" style={{ marginTop: '16px', width: '100%' }} onClick={closeForgot}>
                  BACK TO LOGIN
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;

