import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function Login() {
  const { user, role, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('Client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, role, navigate]);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setAlert(null);
  };

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setAlert(null);

    if (mode === 'signup' && !fullName.trim()) {
      return setError('Please enter your full name.');
    }
    if (!email.trim() || !password) {
      return setError('Please fill in all fields.');
    }
    if (!isValidEmail(email)) {
      return setError('Please enter a valid email address.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setLoading(true);

    if (mode === 'login') {
      try {
        const { profile: prof } = await signIn(email, password);
        const dbRole = prof?.role || selectedRole;
        setAlert({ type: 'success', message: `Welcome back! Logging in as ${dbRole}...` });
        setTimeout(() => {
          navigate('/dashboard');
        }, 600);
      } catch (err) {
        setLoading(false);
        if (err.message?.includes('Invalid login')) {
          setError('Invalid email or password. Account may not exist — please Sign Up first.');
        } else {
          setError(err.message || 'An unexpected error occurred.');
        }
      }
    } else {
      try {
        const data = await signUp(email, password, fullName, selectedRole);
        if (data?.user && !data.session) {
          setAlert({ type: 'success', message: '✓ Account created! Please check your email to verify, then Log In.' });
        } else {
          setAlert({ type: 'success', message: '✓ Account created successfully! Switching to Login...' });
        }
        setTimeout(() => {
          setLoading(false);
          switchMode('login');
        }, 1500);
      } catch (err) {
        setLoading(false);
        if (err.message?.includes('already registered')) {
          setError('This email is already registered. Please Login instead.');
        } else {
          setError(err.message || 'An unexpected error occurred.');
        }
      }
    }
  };

  return (
    <div className="auth-wrap">
      {/* Left Panel — Branding */}
      <div className="auth-left">
        <div className="auth-left-grid"></div>
        <div className="auth-left-glow"></div>
        <div className="auth-brand">
          <div className="auth-brand-logo">Ne<span>x</span>row</div>
          <div className="auth-brand-tag">// secure escrow protocol v2.0</div>
        </div>
        <div className="auth-features">
          <div className="auth-feature">
            <span className="auth-feature-icon">🔒</span>
            <span className="auth-feature-text">Military-grade escrow protection for every transaction</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">⚡</span>
            <span className="auth-feature-text">AI-powered verification & instant settlement</span>
          </div>
          <div className="auth-feature">
            <span className="auth-feature-icon">🔗</span>
            <span className="auth-feature-text">On-chain transparency via Algorand blockchain</span>
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="auth-right">
        <div className="auth-box fade-up">
          {/* Tabs */}
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >Login</button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >Sign Up</button>
          </div>

          {alert && <Alert type={alert.type} message={alert.message} />}

          <div className="auth-form active">
            <div className="form-title">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </div>
            <div className="form-sub">
              {mode === 'login' ? '// Enter your credentials to continue' : '// Join the secure escrow ecosystem'}
            </div>

            {/* Full Name (signup only) */}
            {mode === 'signup' && (
              <div className="field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            {/* Role Selector (Sign Up mode only) */}
            {mode === 'signup' && (
              <div className="field">
                <label>Select Role</label>
                <div className="role-pill-selector">
                  {['Client', 'Freelancer'].map(r => (
                    <button
                      key={r}
                      type="button"
                      className={`role-pill-btn rounded-full ${selectedRole === r ? 'active' : ''}`}
                      onClick={() => setSelectedRole(r)}
                    >{r}</button>
                  ))}
                </div>
                <div className="role-helper-text">
                  <span>Registering as: </span>
                  <span id="selectedRoleHighlight">{selectedRole}</span>
                </div>
              </div>
            )}

            {/* Email */}
            <div className="field">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Password */}
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="inline-error show">{error}</div>
            )}

            {/* Submit */}
            <button
              type="button"
              className="btn btn-gold btn-full"
              style={{ marginTop: '1rem' }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading && <span className="spinner"></span>}
              {loading
                ? (mode === 'login' ? ' Authenticating...' : ' Creating Account...')
                : (mode === 'login' ? 'ENTER NEXROW' : 'CREATE ACCOUNT')
              }
            </button>

            <div className="divider"><span>OR</span></div>

            <button
              type="button"
              className="btn btn-google btn-full"
              onClick={signInWithGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.8 2.71v2.24h2.91c1.7-1.56 2.69-3.86 2.69-6.58z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.24c-.8.54-1.84.87-3.05.87-2.35 0-4.33-1.59-5.04-3.73H.96v2.3C2.45 15.96 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.96 10.72c-.18-.54-.28-1.12-.28-1.72s.1-1.18.28-1.72V4.98H.96C.35 6.19 0 7.56 0 9s.35 2.81.96 4.02l3-2.3z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35L15 2.4C13.46.99 11.42 0 9 0 5.48 0 2.45 2.04.96 5l3 2.3c.71-2.14 2.69-3.72 5.04-3.72z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
