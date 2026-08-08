import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, doc, getDoc, setDoc } from '../lib/firebase';
import Alert from '../components/Alert';

export default function RoleSelect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [loadingRole, setLoadingRole] = useState('');

  useEffect(() => {
    if (!user) return;
    checkExistingRole();
  }, [user]);

  async function checkExistingRole() {
    try {
      if (db) {
        const userSnap = await getDoc(doc(db, 'profiles', user.id));
        if (userSnap.exists() && userSnap.data()?.role) {
          const r = userSnap.data().role.toLowerCase();
          navigate('/dashboard', { replace: true });
        }
      }
    } catch (e) {
      console.error('Error checking role on load:', e);
    }
  }

  async function handleSetRole(roleName, redirectPath) {
    setLoadingRole(roleName);
    setAlert(null);

    try {
      if (db) {
        await setDoc(doc(db, 'profiles', user.id), {
          id: user.id,
          full_name: user.email,
          role: roleName
        }, { merge: true });

        // If they register as a freelancer, also add them to the freelancers provider collection
        if (roleName === 'Freelancer') {
          await setDoc(doc(db, 'freelancers', user.id), {
            name: user.email.split('@')[0],
            domain: 'Full Stack Web Development',
            experience: '1 Year',
            rating: 5.0,
            completed_projects: 0,
            hourly_rate: 1200,
            hourly_rate_display: '₹1,200/hr',
            location: 'Remote',
            availability: 'Available',
            bio: 'Registered Nexrow platform provider.',
            email: user.email,
            joined_at: new Date().toISOString()
          }, { merge: true });
        }
      }

      localStorage.setItem('role', roleName);
      navigate(redirectPath);
    } catch (e) {
      setLoadingRole('');
      setAlert({ type: 'error', message: `Failed to set role: ${e.message}` });
    }
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="role-wrap">
      <div className="role-grid-bg"></div>
      <div className="role-box fade-up">
        <div className="role-logo">Ne<span>x</span>row</div>
        <div className="role-title">How would you like to proceed?</div>
        <div className="role-sub">// Select your role for this session</div>

        {alert && <Alert type={alert.type} message={alert.message} />}

        <div className="role-cards">
          <button
            className="role-card"
            onClick={() => handleSetRole('Freelancer', '/dashboard')}
            disabled={!!loadingRole}
            style={{ opacity: loadingRole === 'Freelancer' ? 0.5 : 1 }}
          >
            <div className="role-card-icon">🛠</div>
            <div className="role-card-name">I am a Freelancer</div>
            <div className="role-card-desc">Create deals, deliver services, and get paid securely.</div>
          </button>

          <button
            className="role-card"
            onClick={() => handleSetRole('Client', '/dashboard')}
            disabled={!!loadingRole}
            style={{ opacity: loadingRole === 'Client' ? 0.5 : 1 }}
          >
            <div className="role-card-icon">👤</div>
            <div className="role-card-name">I am a Client</div>
            <div className="role-card-desc">Enter a deal code and pay securely via escrow.</div>
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--text3)' }}>
            {user?.email}
          </span>
        </div>
        <button className="role-logout" onClick={handleLogout} style={{ marginTop: '0.5rem' }}>Logout</button>
      </div>
    </div>
  );
}
