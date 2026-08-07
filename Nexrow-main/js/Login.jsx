import React, { useState } from 'react';

/**
 * Unified Auth Component supporting both LOGIN and SIGN UP modes
 * using the exact same UI layout and design system.
 */
export default function Login({ onAuthSuccess, onGoogleLogin }) {
  // State variables
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [role, setRole] = useState("Client"); // "Client" | "Freelancer" | "Admin"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Available roles per mode
  const roles = mode === "signup" ? ["Client", "Freelancer"] : ["Client", "Freelancer", "Admin"];

  const handleTabSwitch = (newMode) => {
    setError("");
    setSuccessMsg("");
    setMode(newMode);
    // If switching to signup mode and role was Admin, reset to Client
    if (newMode === "signup" && role === "Admin") {
      setRole("Client");
    }
  };

  const handleRoleSelect = (r) => {
    setRole(r);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (mode === "signup" && !fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    // Store selected role in localStorage
    localStorage.setItem("role", role);

    if (mode === "login") {
      const isRoot = typeof window !== 'undefined' && !window.location.pathname.includes('/pages/');
      const roleRedirects = {
        'Client': isRoot ? 'pages/create-contract.html' : 'create-contract.html',
        'Freelancer': isRoot ? 'pages/upload-proof.html' : 'upload-proof.html',
        'Admin': isRoot ? 'pages/status.html' : 'status.html'
      };
      const redirectUrl = roleRedirects[role] || (isRoot ? 'pages/create-contract.html' : 'create-contract.html');

      setSuccessMsg("Login successful! Redirecting...");
      if (onAuthSuccess) {
        onAuthSuccess({ mode, role, email, password, redirectUrl });
      } else {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      }
    } else {
      // SIGN UP Mode (Demo mode - save role and switch to login)
      setSuccessMsg("Account created successfully! Switching to Login...");
      setTimeout(() => {
        handleTabSwitch("login");
      }, 1000);
    }
  };

  return (
    <div className="auth-box fade-up">
      {/* Auth Tabs */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
          id="tabLogin"
          onClick={() => handleTabSwitch('login')}
        >
          Login
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
          id="tabSignup"
          onClick={() => handleTabSwitch('signup')}
        >
          Sign Up
        </button>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <span>✓</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Unified Form */}
      <div className="auth-form active" id="loginForm">
        <div className="form-title" id="formTitle">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </div>
        <div className="form-sub" id="formSub">
          {mode === 'login' ? '// Enter your credentials to continue' : '// Join the secure escrow ecosystem'}
        </div>

        {/* Full Name field (SIGN UP mode only) */}
        {mode === 'signup' && (
          <div className="field" id="fullNameField">
            <label>Full Name</label>
            <input
              type="text"
              id="signupNameInput"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}

        {/* Role Selector Component */}
        <div className="field">
          <label>Select Role</label>
          <div className="role-pill-selector" id="loginRoleSelector">
            {roles.map((r) => (
              <button
                key={r}
                type="button"
                className={`role-pill-btn rounded-full ${role === r ? 'active' : ''}`}
                onClick={() => handleRoleSelect(r)}
                data-role={r}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Dynamic Helper Text */}
          <div className="role-helper-text" id="roleHelperText">
            <span>{mode === 'login' ? 'Logging in as: ' : 'Registering as: '}</span>
            <span id="selectedRoleHighlight">{role}</span>
          </div>
        </div>

        {/* Email Field */}
        <div className="field">
          <label>Email Address</label>
          <input
            type="email"
            id="loginEmail"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Password Field */}
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            id="loginPassword"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className={`inline-error ${error ? 'show' : ''}`} id="loginError">
          {error}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          className="btn btn-gold btn-full"
          id="loginBtn"
          style={{ marginTop: '1rem' }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {mode === 'login' ? 'ENTER NEXROW' : 'CREATE ACCOUNT'}
        </button>

        <div className="divider"><span>OR</span></div>

        <button
          type="button"
          className="btn btn-google btn-full google-login-btn"
          onClick={onGoogleLogin}
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
  );
}
