import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setAlert(null);

    if (!email.trim() || !password) {
      return setError('Please fill in all fields.');
    }

    setLoading(true);

    setTimeout(() => {
      if (email.trim().toLowerCase() === 'admin@gmail.com' && password === 'admin123') {
        localStorage.setItem('nexrow_admin_auth', 'true');
        localStorage.setItem('nexrow_admin_email', 'admin@gmail.com');
        setAlert({ type: 'success', message: '✓ Access Granted. Redirecting to Control Center...' });
        setTimeout(() => {
          navigate('/admin');
        }, 800);
      } else {
        setLoading(false);
        setError('Invalid Admin credentials. Access denied.');
      }
    }, 500);
  };

  return (
    <div className="auth-wrap">
      {/* Left Branding */}
      <div className="auth-left">
        <div className="auth-left-grid"></div>
        <div className="auth-left-glow"></div>
        <div className="auth-brand">
          <div className="auth-brand-logo">Ne<span>x</span>row</div>
          <div className="auth-brand-tag">// ENTERPRISE GOVERNANCE PORTAL</div>
        </div>
        <div className="auth-features">
          <div className="auth-feature">
            <span className="auth-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <span className="auth-feature-text">System Administrator Control Center</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>
            <span className="auth-feature-text">Full Oversight & Resolution Rights</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </span>
            <span className="auth-feature-text">Dispute Mediation & Master Deals Ledger</span>
          </div>
        </div>
      </div>

      {/* Right Login Box */}
      <div className="auth-right">
        <div className="auth-box fade-up">
          <div className="auth-header mb-3">
            <div className="tag" style={{ color: 'var(--amber)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>// RESTRICTED ACCESS</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginTop: '0.4rem' }}>
              Admin Control Login
            </h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              Enter administrator credentials to manage platform vault and governance.
            </p>
          </div>

          {alert && <Alert type={alert.type} message={alert.message} />}
          {error && <div className="alert alert-error fade-in" style={{ marginBottom: '1rem' }}><span>✕</span><span>{error}</span></div>}

          <form onSubmit={handleLogin} className="auth-form active">
            <div className="field">
              <label>Admin Email</label>
              <input
                type="email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-gold btn-full mt-2" disabled={loading}>
              {loading ? <><span className="spinner"></span> Authenticating...</> : 'Authenticate Admin Access'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', cursor: 'pointer' }}
            >
              ← Back to User Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
