import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

export default function OtpVerify() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [alert, setAlert] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    // Generate OTP
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (idx, value) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[idx] = value;
    setOtp(newOtp);

    // Auto-focus next
    if (value && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const entered = otp.join('');
    if (entered.length !== 6) {
      return setAlert({ type: 'error', message: 'Please enter the complete 6-digit OTP.' });
    }

    setVerifying(true);
    setAlert(null);

    await new Promise(r => setTimeout(r, 1500));

    if (entered === generatedOtp) {
      setAlert({ type: 'success', message: 'OTP verified successfully! Redirecting...' });
      setTimeout(() => navigate('/dashboard'), 1200);
    } else {
      // For demo, accept any OTP
      setAlert({ type: 'success', message: 'OTP verified! Redirecting...' });
      setTimeout(() => navigate('/dashboard'), 1200);
    }
    setVerifying(false);
  };

  const handleResend = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setCountdown(30);
    setAlert({ type: 'success', message: 'New OTP sent!' });
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
          <div className="otp-card fade-up">
            <div className="otp-icon">🔐</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Verify OTP</h2>
            <p style={{ fontSize: '0.82rem', marginBottom: '1.2rem' }}>
              Enter the 6-digit verification code
            </p>

            <div className="otp-hint">
              Demo OTP: <strong>{generatedOtp}</strong>
            </div>

            {alert && <Alert type={alert.type} message={alert.message} />}

            <div className="otp-inputs">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={el => inputRefs.current[idx] = el}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                />
              ))}
            </div>

            <button
              className="btn btn-gold btn-full"
              onClick={handleVerify}
              disabled={verifying}
              style={{ marginBottom: '1rem' }}
            >
              {verifying ? <><span className="spinner"></span> Verifying...</> : 'Verify OTP'}
            </button>

            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--text3)' }}>
              {countdown > 0 ? (
                <span>Resend in {countdown}s</span>
              ) : (
                <button
                  onClick={handleResend}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline' }}
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
