import React, { useState, useEffect, useRef } from 'react';
import API from './config';
import './LoginPage.css';

const OTP_LENGTH = 6;

const LoginPage = ({ onLogin }) => {
  // ── Mode: 'password' | 'otp'
  const [authMode, setAuthMode] = useState('password');

  // Common identifier
  const [employeeId, setEmployeeId] = useState('');

  // ── Password Login State
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // ── Force Password Change Modal State (First Login)
  const [showForceChange, setShowForceChange] = useState(false);
  const [tempAuthData, setTempAuthData] = useState(null);
  const [forceNewPassword, setForceNewPassword] = useState('');
  const [forceConfirmPassword, setForceConfirmPassword] = useState('');
  const [forceError, setForceError] = useState('');
  const [forceLoading, setForceLoading] = useState(false);

  // ── OTP State: 'id' → 'otp'
  const [step, setStep] = useState('id');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [verifyStatus, setVerifyStatus] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'error'
  const [verifyError, setVerifyError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // seconds
  const otpRefs = useRef([]);
  const cooldownTimer = useRef(null);

  const [logoLoaded, setLogoLoaded] = useState(false);
  const pub = process.env.PUBLIC_URL || '';

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownTimer.current = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(cooldownTimer.current);
  }, [resendCooldown]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (authMode === 'otp' && step === 'otp' && otpRefs.current[0]) {
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }
  }, [authMode, step]);

  // Background email delivery verification for proactive feedback
  useEffect(() => {
    if (authMode !== 'otp' || step !== 'otp' || !employeeId.trim()) return;
    let pollCount = 0;
    const maxPolls = 10;
    let pollTimer = null;

    const checkDeliveryStatus = async () => {
      try {
        const res = await fetch(`${API}/deva/auth/otp-status?employeeId=${encodeURIComponent(employeeId.trim())}`);
        const data = await res.json();
        if (data.success && data.data) {
          const { deliveryStatus, deliveryError } = data.data;
          if (deliveryStatus === 'failed') {
            const cleanError = deliveryError || 'Unable to deliver OTP email. Please click Resend or contact administrator.';
            setVerifyError(cleanError);
            setResendCooldown(0); // Allow immediate retry
            return;
          }
          if (deliveryStatus === 'sent') {
            return; // Confirmed delivered
          }
        }
      } catch {
        // Non-blocking network check
      }

      pollCount += 1;
      if (pollCount < maxPolls && step === 'otp') {
        pollTimer = setTimeout(checkDeliveryStatus, 2500);
      }
    };

    pollTimer = setTimeout(checkDeliveryStatus, 2000);
    return () => clearTimeout(pollTimer);
  }, [authMode, step, employeeId, resendCooldown]);

  // ── Password Login Handler ──
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginError('');

    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      setLoginError('Please enter your Employee ID or registered Email.');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password (default: registered mobile number).');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(`${API}/deva/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: trimmedId, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setLoginError(data.message || 'Login failed. Please check your credentials.');
      } else if (data.data?.token && data.data?.user) {
        const { token, user } = data.data;

        // If force password change is active, prompt with modal (with skip option)
        if (user.forcePasswordChange) {
          setTempAuthData(data.data);
          setShowForceChange(true);
        } else {
          localStorage.setItem('wlm_token', token);
          localStorage.setItem('wlm_user', JSON.stringify(user));
          onLogin(user);
        }
      } else {
        setLoginError('Invalid response from server. Please try again.');
      }
    } catch {
      setLoginError('Could not reach server. Please check your connection.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Force Password Change Submit ──
  const handleForceChangeSubmit = async (e) => {
    e.preventDefault();
    if (forceLoading) return;
    setForceError('');

    if (forceNewPassword.length < 8) {
      setForceError('New password must be at least 8 characters.');
      return;
    }
    if (forceNewPassword !== forceConfirmPassword) {
      setForceError('New password and confirm password do not match.');
      return;
    }
    if (forceNewPassword === password) {
      setForceError('New password must be different from your current default password.');
      return;
    }

    setForceLoading(true);
    try {
      const res = await fetch(`${API}/deva/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tempAuthData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: password,
          newPassword: forceNewPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setForceError(data.message || 'Failed to update password.');
      } else {
        const finalToken = data.data?.token || tempAuthData.token;
        const finalUser = data.data?.user || { ...tempAuthData.user, forcePasswordChange: false };
        localStorage.setItem('wlm_token', finalToken);
        localStorage.setItem('wlm_user', JSON.stringify(finalUser));
        setShowForceChange(false);
        onLogin(finalUser);
      }
    } catch {
      setForceError('Could not reach server. Please try again.');
    } finally {
      setForceLoading(false);
    }
  };

  // ── Skip Force Password Change ──
  const handleSkipForceChange = () => {
    if (!tempAuthData) return;
    localStorage.setItem('wlm_token', tempAuthData.token);
    localStorage.setItem('wlm_user', JSON.stringify(tempAuthData.user));
    setShowForceChange(false);
    onLogin(tempAuthData.user);
  };

  // ── Step 1: Request OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (sendLoading) return;
    setSendError('');
    if (!employeeId.trim()) {
      setSendError('Please enter your Employee ID or registered Email.');
      return;
    }
    setSendLoading(true);
    try {
      const res = await fetch(`${API}/deva/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSendError(data.message || 'Failed to send OTP. Please try again.');
      } else {
        setMaskedEmail(data.data?.maskedEmail || '');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setVerifyError('');
        setResendCooldown(data.data?.cooldownSeconds || 60);
        setStep('otp');
      }
    } catch {
      setSendError('Could not reach server. Please check your connection.');
    } finally {
      setSendLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──
  const handleVerifyOtp = async (e, directOtp) => {
    if (e) e.preventDefault();
    if (verifyStatus === 'verifying' || verifyStatus === 'success') return;
    const otp = directOtp || otpDigits.join('');
    if (otp.length < OTP_LENGTH) {
      setVerifyStatus('error');
      setVerifyError(`Please enter the full ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    setVerifyError('');
    setVerifyStatus('verifying');
    try {
      const res = await fetch(`${API}/deva/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim(), otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerifyStatus('error');
        setVerifyError(data.message || 'Invalid OTP. Please try again.');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } else {
        setVerifyStatus('success');
        setTimeout(() => {
          localStorage.setItem('wlm_token', data.data.token);
          localStorage.setItem('wlm_user', JSON.stringify(data.data.user));
          onLogin(data.data.user);
        }, 1200);
      }
    } catch {
      setVerifyStatus('error');
      setVerifyError('Could not reach server. Please check your connection.');
    }
  };

  // ── OTP digit input handlers ──
  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setVerifyError('');

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    if (digit && index === OTP_LENGTH - 1 && next.every(d => d !== '')) {
      setTimeout(() => handleVerifyOtp(null, next.join('')), 50);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();
    if (pasted.length === OTP_LENGTH) {
      setTimeout(() => handleVerifyOtp(null, next.join('')), 50);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || sendLoading) return;
    setSendError('');
    setVerifyError('');
    setSendLoading(true);
    try {
      const res = await fetch(`${API}/deva/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVerifyError(data.message || 'Failed to resend OTP.');
      } else {
        setMaskedEmail(data.data?.maskedEmail || maskedEmail);
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setResendCooldown(data.data?.cooldownSeconds || 60);
        setTimeout(() => otpRefs.current[0]?.focus(), 80);
      }
    } catch {
      setVerifyError('Could not reach server.');
    } finally {
      setSendLoading(false);
    }
  };

  const wrapperBg = { backgroundImage: `url('${pub}/image.webp')` };

  return (
    <div className="wlm-wrapper" style={wrapperBg}>
      <div className="wlm-card">

        {/* Left Panel */}
        <div className="wlm-left">
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

          {/* ── Mode Switcher Tabs ── */}
          <div className="wlm-auth-tabs">
            <button
              type="button"
              className={`wlm-auth-tab ${authMode === 'password' ? 'active' : ''}`}
              onClick={() => { setAuthMode('password'); setLoginError(''); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Password Login
            </button>
            <button
              type="button"
              className={`wlm-auth-tab ${authMode === 'otp' ? 'active' : ''}`}
              onClick={() => { setAuthMode('otp'); setSendError(''); setVerifyError(''); }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              OTP via Email
            </button>
          </div>

          {/* ════════════════════════════════════════════════
              MODE A: PASSWORD LOGIN (Default / Primary)
             ════════════════════════════════════════════════ */}
          {authMode === 'password' && (
            <>
              <h2 className="wlm-title">Member Login</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '16px', lineHeight: 1.5 }}>
                Enter your <strong style={{ color: '#fff' }}>Employee ID</strong> and password.
              </p>

              <form className="wlm-form" onSubmit={handlePasswordLogin}>
                {/* Employee ID or Email */}
                <div className="wlm-input-group">
                  <span className="wlm-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Employee ID or Email"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    className="wlm-input"
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>

                {/* Password Input */}
                <div className="wlm-input-group">
                  <span className="wlm-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (Default: Mobile No)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="wlm-input"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="wlm-eye-btn"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-4px' }}>
                  <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.7)' }}>
                    Default Password: <b style={{ color: '#a5b4fc' }}>Registered Mobile No</b>
                  </span>
                  <button
                    type="button"
                    className="wlm-forgot-link"
                    style={{ fontSize: '11.5px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => { setAuthMode('otp'); setStep('id'); }}
                  >
                    Use OTP instead
                  </button>
                </div>

                <button type="submit" className="wlm-login-btn" disabled={loginLoading} style={{ marginTop: '8px' }}>
                  {loginLoading
                    ? <><span className="wlm-btn-spinner" /> SIGNING IN…</>
                    : 'SIGN IN'}
                </button>

                {loginError && <p className="wlm-error">{loginError}</p>}
              </form>
            </>
          )}

          {/* ════════════════════════════════════════════════
              MODE B: OTP LOGIN (Optional alternative)
             ════════════════════════════════════════════════ */}
          {authMode === 'otp' && step === 'id' && (
            <>
              <h2 className="wlm-title">OTP Login</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '20px', lineHeight: 1.5 }}>
                Enter your <strong style={{ color: '#fff' }}>Employee ID</strong> to receive a one-time password on your registered email.
              </p>
              <form className="wlm-form" onSubmit={handleSendOtp}>
                <div className="wlm-input-group">
                  <span className="wlm-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Employee ID or Email"
                    value={employeeId}
                    onChange={e => setEmployeeId(e.target.value)}
                    className="wlm-input"
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>

                <button type="submit" className="wlm-login-btn" disabled={sendLoading}>
                  {sendLoading
                    ? <><span className="wlm-btn-spinner" /> SENDING OTP…</>
                    : 'SEND OTP'}
                </button>

                {sendError && <p className="wlm-error">{sendError}</p>}

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="wlm-forgot-link"
                    style={{ fontSize: '12px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => { setAuthMode('password'); }}
                  >
                    ← Back to Password Login
                  </button>
                </div>
              </form>
            </>
          )}

          {authMode === 'otp' && step === 'otp' && (
            <>
              <h2 className="wlm-title">Enter OTP</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '6px', lineHeight: 1.5 }}>
                A 6-digit OTP has been sent to
              </p>
              {maskedEmail && (
                <p style={{ fontSize: '14px', color: '#a5b4fc', fontWeight: 600, marginBottom: '20px', wordBreak: 'break-all' }}>
                  {maskedEmail}
                </p>
              )}

              <form className="wlm-form" onSubmit={handleVerifyOtp}>
                {/* OTP digit boxes */}
                <div className={`wlm-otp-wrapper status-${verifyStatus}`}>
                  <div className="wlm-otp-row" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => (otpRefs.current[i] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpDigit(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`wlm-otp-box${digit ? ' wlm-otp-filled' : ''}`}
                        autoComplete="one-time-code"
                        disabled={verifyStatus === 'verifying' || verifyStatus === 'success'}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="wlm-login-btn"
                  disabled={verifyStatus === 'verifying' || verifyStatus === 'success' || otpDigits.join('').length < OTP_LENGTH}
                  style={{ marginTop: '8px' }}
                >
                  {verifyStatus === 'verifying'
                    ? <><span className="wlm-btn-spinner" /> VERIFYING…</>
                    : verifyStatus === 'success'
                      ? 'SUCCESS!'
                      : 'VERIFY & LOGIN'}
                </button>

                {verifyError && <p className="wlm-error">{verifyError}</p>}
              </form>

              {/* Resend + Back */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  className="wlm-forgot-link"
                  style={{ fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onClick={() => { setStep('id'); setSendError(''); setVerifyError(''); }}
                >
                  ← Change ID
                </button>
                <button
                  type="button"
                  className="wlm-forgot-link"
                  style={{ fontSize: '13px', opacity: resendCooldown > 0 ? 0.5 : 1, cursor: resendCooldown > 0 ? 'default' : 'pointer', background: 'transparent', border: 'none' }}
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || sendLoading}
                >
                  {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Force Password Change Modal (First Login with Default Mobile No) ── */}
      {showForceChange && (
        <div className="wlm-modal-overlay">
          <div className="wlm-modal">
            <h3 className="wlm-modal-title">Set Custom Password</h3>
            <p className="wlm-modal-desc">
              You are currently logging in with your default password (registered mobile number). For better account security, you may set a personal password now, or continue to your dashboard.
            </p>
            <form onSubmit={handleForceChangeSubmit}>
              <div className="wlm-input-group" style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  placeholder="New Password (min 8 characters)"
                  value={forceNewPassword}
                  onChange={e => setForceNewPassword(e.target.value)}
                  className="wlm-input"
                  style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                  required
                  autoFocus
                />
              </div>
              <div className="wlm-input-group" style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={forceConfirmPassword}
                  onChange={e => setForceConfirmPassword(e.target.value)}
                  className="wlm-input"
                  style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
                  required
                />
              </div>

              {forceError && <p className="wlm-error" style={{ marginBottom: '10px' }}>{forceError}</p>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="wlm-login-btn"
                  style={{ flex: 1, background: '#64748b' }}
                  onClick={handleSkipForceChange}
                  disabled={forceLoading}
                >
                  SKIP FOR NOW
                </button>
                <button
                  type="submit"
                  className="wlm-login-btn"
                  style={{ flex: 1.2 }}
                  disabled={forceLoading}
                >
                  {forceLoading ? 'SAVING…' : 'UPDATE PASSWORD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
