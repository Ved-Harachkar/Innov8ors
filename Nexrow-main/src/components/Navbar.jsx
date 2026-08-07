import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const email = user?.email || '';
  const displayEmail = email.length > 24 ? email.slice(0, 22) + '…' : email;

  return (
    <nav className="topnav">
      <Link to="/dashboard" className="nav-logo">Ne<span>x</span>row</Link>
      <div className="nav-right">
        <span className="nav-user">{displayEmail}</span>
        <button className="nav-logout" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
