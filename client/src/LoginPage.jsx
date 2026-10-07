import React, { useState, useEffect, useRef } from 'react';
import API from './config';
import './LoginPage.css';

const OTP_LENGTH = 6;

const LoginPage = ({ onLogin }) => {
  // ── Step: 'id' → 'otp'
  const [step, setStep] = useState('id');

  // Step 1 — Employee ID
  const [employeeId, setEmployeeId]   = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError,   setSendError]   = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // Step 2 — OTP
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [verifyStatus, setVerifyStatus] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'error'
  const [verifyError,   setVerifyError]   = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);  // seconds
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
    if (step === 'otp' && otpRefs.current[0]) {
      setTimeout(() => otpRefs.current[0]?.focus(), 80);
    }
  }, [step]);

  // ── Step 1: Request OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (sendLoading) return;
    setSendError('');
    if (!employeeId.trim()) {
      setSendError('Please enter your Employee ID.');
      return;
    }
    setSendLoading(true);
    try {
      const res  = await fetch(`${API}/deva/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = await res.json();
      if (!data.success && res.status !== 200) {
        setSendError(data.message || 'Failed to send OTP. Please try again.');
      } else {
        setMaskedEmail(data.data?.maskedEmail || '');
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setVerifyError('');
        setResendCooldown(60); // 60-second cooldown before resend
        setStep('otp');
      }
    } catch {
      setSendError('Could not reach server. Please check your connection.');
    } finally {
      setSendLoading(false);
    }
  };

  // ── Step 2: Verify OTP
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
      const res  = await fetch(`${API}/deva/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: employeeId.trim(), otp }),
      });
      const data = await res.json();
      if (!data.success) {
        setVerifyStatus('error');
        setVerifyError(data.message || 'Invalid OTP. Please try again.');
        // Clear OTP boxes on error
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } else {
        setVerifyStatus('success');
        // Let the success animation play briefly
        setTimeout(() => {
          localStorage.setItem('wlm_token', data.data.token);
          localStorage.setItem('wlm_user', JSON.stringify(data.data.user));
          onLogin(data.data.user);
        }, 1500);
      }
    } catch {
      setVerifyStatus('error');
      setVerifyError('Could not reach server. Please check your connection.');
    }
  };

  // ── OTP digit input handler
  const handleOtpDigit = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1); // only last digit
    const next  = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setVerifyError('');

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all filled
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
      const res  = await fetch(`${API}/deva/auth/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = await res.json();
      if (!data.success && res.status !== 200) {
        setVerifyError(data.message || 'Failed to resend OTP.');
      } else {
        setMaskedEmail(data.data?.maskedEmail || maskedEmail);
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setResendCooldown(60);
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

          {/* ── STEP 1: Employee ID ── */}
          {step === 'id' && (
            <>
              <h2 className="wlm-title">Member Login</h2>
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
                    placeholder="Employee ID"
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
              </form>
            </>
          )}

          {/* ── STEP 2: OTP Entry ── */}
          {step === 'otp' && (
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
                  className="wlm-forgot-link"
                  style={{ fontSize: '13px' }}
                  onClick={() => { setStep('id'); setSendError(''); setVerifyError(''); }}
                >
                  ← Change ID
                </button>
                <button
                  className="wlm-forgot-link"
                  style={{ fontSize: '13px', opacity: resendCooldown > 0 ? 0.5 : 1, cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
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
    </div>
  );
};

export default LoginPage;
