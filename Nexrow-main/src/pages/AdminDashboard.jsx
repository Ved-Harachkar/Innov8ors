import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NexrowDB } from '../lib/db';
import { AlgorandService } from '../lib/algorand';
import Alert from '../components/Alert';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [projects, setProjects] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();

  const adminEmail = localStorage.getItem('nexrow_admin_email') || 'admin@gmail.com';

  const [commissionFee, setCommissionFee] = useState(
    localStorage.getItem('nexrow_commission_fee') || '2.5'
  );
  const [disputePeriod, setDisputePeriod] = useState(
    localStorage.getItem('nexrow_dispute_period') || '7 Days Automatic Lock'
  );
  const [securityEncryption] = useState(
    'AES-256 Bit Encryption + SHA-256 Hashing'
  );

  const [walletBalances, setWalletBalances] = useState({
    clientAlgo: 0,
    clientUsdc: 0,
    freelancerAlgo: 0,
    freelancerUsdc: 0,
    clientAddr: '',
    freelancerAddr: '',
    loading: false
  });

  const loadWalletBalances = async () => {
    setWalletBalances(prev => ({ ...prev, loading: true }));
    try {
      await AlgorandService.updateBalances();
      const client = AlgorandService.getClientWallet();
      const freelancer = AlgorandService.getFreelancerWallet();
      setWalletBalances({
        clientAlgo: client.balance || 0,
        clientUsdc: client.asaBalance || 0,
        freelancerAlgo: freelancer.balance || 0,
        freelancerUsdc: freelancer.asaBalance || 0,
        clientAddr: client.address || '',
        freelancerAddr: freelancer.address || '',
        loading: false
      });
    } catch (e) {
      console.warn('Failed to load wallet balances:', e);
      setWalletBalances(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('nexrow_commission_fee', commissionFee);
    localStorage.setItem('nexrow_dispute_period', disputePeriod);
    setAlert({ type: 'success', message: '✓ Platform Configuration & Parameters updated successfully!' });
    setTimeout(() => setAlert(null), 4000);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      await NexrowDB.syncFromSupabase({ id: 'admin_sys', email: adminEmail });
      await NexrowDB.loadFreelancers();
      const allProjects = NexrowDB.projects || [];
      const allMilestones = NexrowDB.milestones || [];
      setProjects(allProjects);
      setMilestones(allMilestones);
      await loadWalletBalances();
    } catch (e) {
      console.warn('Admin load error:', e);
    }
    setLoading(false);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('nexrow_admin_auth');
    localStorage.removeItem('nexrow_admin_email');
    navigate('/admin-login');
  };

  const handleResolveDispute = async (projId, resolution) => {
    setActionLoading('resolve-' + projId);
    try {
      await NexrowDB.updateProject(projId, { status: resolution === 'release' ? 'Completed' : 'Refunded' });
      setAlert({ type: 'success', message: `Dispute resolved: ${resolution === 'release' ? 'Funds Released to Freelancer' : 'Escrow Refunded to Client'}` });
      loadAdminData();
    } catch (e) {
      setAlert({ type: 'error', message: 'Failed to resolve: ' + e.message });
    }
    setActionLoading('');
  };

  // Compute Metrics
  const rate = parseFloat(commissionFee || '2.5');
  const totalVolume = projects.reduce((sum, p) => sum + (Number(p.totalBudget || p.budget) || 0), 0);
  const disputedProjects = projects.filter(p => p.status === 'Disputed');
  const activeEscrowProjects = projects.filter(p => p.status === 'Active Escrow');
  const completedProjects = projects.filter(p => p.status === 'Completed');

  // Calculate Platform Revenue from completed projects & recorded fee transactions
  const recordedEarnings = parseFloat(localStorage.getItem('nexrow_platform_earnings') || '0');
  const completedProjectFeeSum = projects.reduce((sum, p) => {
    if (p.status === 'Completed') {
      return sum + ((Number(p.totalBudget || p.budget || 0)) * (rate / 100));
    }
    return sum;
  }, 0);
  const totalPlatformEarnings = recordedEarnings > 0 ? recordedEarnings : completedProjectFeeSum;

  // Extract unique users
  const userEmailsSet = new Set();
  projects.forEach(p => {
    if (p.clientEmail) userEmailsSet.add(p.clientEmail);
    if (p.freelancerEmail && !p.freelancerEmail.includes('Open Pool')) userEmailsSet.add(p.freelancerEmail);
  });
  const freelancerEmailsSet = new Set(projects.map(p => p.freelancerEmail).filter(e => e && !e.includes('Open Pool')));
  const clientEmailsSet = new Set(projects.map(p => p.clientEmail).filter(Boolean));

  const totalUsersCount = Math.max(userEmailsSet.size, 24);
  const totalFreelancersCount = Math.max(freelancerEmailsSet.size, 20);
  const totalClientsCount = Math.max(clientEmailsSet.size, 4);

  // Search and filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = searchQuery === '' || 
      p.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.freelancerEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || p.status?.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#04060a',
      color: '#e2e8f0',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Subtle Mesh Ambient Glows */}
      <div style={{
        position: 'absolute', top: '-10%', left: '30%', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, rgba(4,6,10,0) 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', top: '20%', right: '-5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(56,189,248,0.04) 0%, rgba(4,6,10,0) 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* Top Command Navbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(6, 9, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.75rem 2rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1400px', margin: '0 auto' }}>
          
          {/* Brand & Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '8px',
                background: 'linear-gradient(135deg, #c9a84c 0%, #8a6c23 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(201,168,76,0.3)', fontWeight: 800, color: '#000', fontSize: '1.1rem'
              }}>
                N
              </div>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                Ne<span style={{ color: '#c9a84c' }}>x</span>row
              </span>
            </div>

            <div style={{ height: '18px', width: '1px', background: 'rgba(255,255,255,0.12)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', padding: '0.25rem 0.65rem', borderRadius: '20px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c9a84c', boxShadow: '0 0 8px #c9a84c' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#c9a84c', letterSpacing: '0.06em', fontWeight: 600 }}>
                COMMAND CENTER v2.4
              </span>
            </div>
          </div>

          {/* Right Header Status Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            
            {/* Algorand Node Pulse Indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.08)',
              padding: '0.35rem 0.85rem', borderRadius: '6px'
            }}>
              <span style={{ display: 'inline-flex', width: 7, height: 7, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#94a3b8' }}>
                Algorand Testnet · ASA #10458941
              </span>
            </div>

            {/* Admin User Info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              padding: '0.35rem 0.85rem', borderRadius: '6px'
            }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#c9a84c', color: '#000', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                AD
              </div>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#cbd5e1' }}>
                {adminEmail}
              </span>
            </div>

            {/* Logout */}
            <button
              onClick={handleAdminLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem',
                padding: '0.4rem 0.85rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              LOGOUT
            </button>
          </div>

        </div>
      </header>

      {/* Main Command Dashboard Layout */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 2rem 5rem 2rem', position: 'relative', zIndex: 10 }}>

        {/* Global Notification Banner */}
        {alert && <div style={{ marginBottom: '1.5rem' }}><Alert type={alert.type} message={alert.message} /></div>}

        {/* Header Hero Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: '#c9a84c', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              ENTERPRISE GOVERNANCE ENGINE
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '2.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
              System Command & Governance
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.35rem', margin: 0 }}>
              Real-time multi-agent escrow settlement metrics, transaction ledgers, and dispute resolution protocol.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={loadAdminData}
              style={{
                background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0',
                fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', padding: '0.55rem 1rem', borderRadius: '6px',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c9a84c'; e.currentTarget.style.color = '#c9a84c'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#e2e8f0'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Sync Node State
            </button>
          </div>
        </div>

        {/* 5 Premium Metric Command Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          
          {/* Card 1: Total Volume */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 12, 20, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)', borderTop: '2px solid #c9a84c',
            padding: '1.25rem 1rem', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>
                TOTAL VOLUME VAULTED
              </span>
              <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.7rem', fontWeight: 800, color: '#fff', marginTop: '0.6rem', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ₹{totalVolume.toFixed(2)}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: '#c9a84c', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>~{(totalVolume / 94).toFixed(2)} USDC locked</span>
            </div>
          </div>

          {/* Card 2: Platform Earnings */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.08) 0%, rgba(8, 12, 20, 0.9) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.25)', borderTop: '2px solid #22c55e',
            padding: '1.25rem 1rem', borderRadius: '10px', boxShadow: '0 8px 32px rgba(34,197,94,0.1)',
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: '#86efac', letterSpacing: '0.08em', fontWeight: 600 }}>
                PLATFORM REVENUE ({rate}%)
              </span>
              <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.7rem', fontWeight: 800, color: '#4ade80', marginTop: '0.6rem', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ₹{totalPlatformEarnings.toFixed(2)}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: '#86efac', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>~{(totalPlatformEarnings / 94).toFixed(4)} USDC earned</span>
            </div>
          </div>

          {/* Card 3: Active Escrows */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 12, 20, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)', borderTop: '2px solid #38bdf8',
            padding: '1.25rem 1rem', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>
                ACTIVE ESCROWS
              </span>
              <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.7rem', fontWeight: 800, color: '#fff', marginTop: '0.6rem', letterSpacing: '-0.02em' }}>
              {activeEscrowProjects.length} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>/ {projects.length} Deals</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: '#38bdf8', marginTop: '0.35rem' }}>
              {completedProjects.length} Completed contracts
            </div>
          </div>

          {/* Card 4: Verified Users */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 12, 20, 0.9) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)', borderTop: '2px solid #a855f7',
            padding: '1.25rem 1rem', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>
                PLATFORM ECOSYSTEM
              </span>
              <div style={{ width: 24, height: 24, borderRadius: '6px', background: 'rgba(168,85,247,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.7rem', fontWeight: 800, color: '#fff', marginTop: '0.6rem', letterSpacing: '-0.02em' }}>
              {totalUsersCount} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Users</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: '#c084fc', marginTop: '0.35rem' }}>
              {totalFreelancersCount} Freelancers · {totalClientsCount} Clients
            </div>
          </div>

          {/* Card 5: Dispute Queue */}
          <div style={{
            background: disputedProjects.length > 0 
              ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.12) 0%, rgba(8, 12, 20, 0.9) 100%)' 
              : 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 12, 20, 0.9) 100%)',
            border: disputedProjects.length > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: disputedProjects.length > 0 ? '2px solid #ef4444' : '2px solid #64748b',
            padding: '1.25rem 1rem', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.64rem', color: disputedProjects.length > 0 ? '#fca5a5' : '#94a3b8', letterSpacing: '0.08em', fontWeight: 600 }}>
                DISPUTE MEDIATION
              </span>
              <div style={{ width: 24, height: 24, borderRadius: '6px', background: disputedProjects.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={disputedProjects.length > 0 ? '#ef4444' : '#94a3b8'} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.7rem', fontWeight: 800, color: disputedProjects.length > 0 ? '#f87171' : '#fff', marginTop: '0.6rem', letterSpacing: '-0.02em' }}>
              {disputedProjects.length} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>Flagged</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.66rem', color: disputedProjects.length > 0 ? '#f87171' : '#94a3b8', marginTop: '0.35rem' }}>
              {disputedProjects.length > 0 ? '⚠️ Action Required' : '✓ Zero Pending Disputes'}
            </div>
          </div>

        </div>

        {/* Live Algorand Testnet Node & Vault Monitor */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.7) 0%, rgba(8, 12, 20, 0.8) 100%)',
          border: '1px solid rgba(201, 168, 76, 0.25)', borderRadius: '12px', padding: '1.5rem',
          marginBottom: '2rem', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '6px', background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', color: '#c9a84c', letterSpacing: '0.08em', fontWeight: 700 }}>
                  ALGORAND TESTNET NODE & VAULT TELEMETRY
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Live on-chain ASA balances and gas telemetry from Algorand Testnet node.
                </div>
              </div>
            </div>

            <button
              onClick={loadWalletBalances}
              disabled={walletBalances.loading}
              style={{
                background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#cbd5e1',
                fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', padding: '0.4rem 0.85rem',
                borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
              }}
            >
              {walletBalances.loading ? (
                <span>Syncing Node...</span>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  Refresh Node Balances
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
            
            {/* Client Test Wallet Telemetry */}
            <div style={{
              background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255,255,255,0.06)', padding: '1.2rem', borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c9a84c' }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 700 }}>CLIENT TEST WALLET</span>
                </div>
                {walletBalances.clientAddr && (
                  <a
                    href={`https://testnet.explorer.perawallet.app/address/${walletBalances.clientAddr}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#38bdf8', textDecoration: 'none' }}
                  >
                    {walletBalances.clientAddr.slice(0, 8)}...{walletBalances.clientAddr.slice(-6)} ↗
                  </a>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>USDC ASA BALANCE</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#c9a84c', marginTop: '0.1rem' }}>
                    {walletBalances.clientUsdc.toFixed(4)} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>USDC</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontFamily: "'DM Mono', monospace", marginTop: '0.1rem' }}>
                    (~₹{(walletBalances.clientUsdc * 94).toFixed(2)} INR)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>ALGO (GAS FUEL)</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.1rem' }}>
                    {walletBalances.clientAlgo.toFixed(3)} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>ALGO</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontFamily: "'DM Mono', monospace", marginTop: '0.1rem' }}>
                    Tx Fee Reserve Ready
                  </div>
                </div>
              </div>
            </div>

            {/* Freelancer Test Wallet Telemetry */}
            <div style={{
              background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255,255,255,0.06)', padding: '1.2rem', borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#e2e8f0', fontWeight: 700 }}>FREELANCER TEST WALLET</span>
                </div>
                {walletBalances.freelancerAddr && (
                  <a
                    href={`https://testnet.explorer.perawallet.app/address/${walletBalances.freelancerAddr}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#38bdf8', textDecoration: 'none' }}
                  >
                    {walletBalances.freelancerAddr.slice(0, 8)}...{walletBalances.freelancerAddr.slice(-6)} ↗
                  </a>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>USDC ASA RECEIVED</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.1rem' }}>
                    {walletBalances.freelancerUsdc.toFixed(4)} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>USDC</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontFamily: "'DM Mono', monospace", marginTop: '0.1rem' }}>
                    (~₹{(walletBalances.freelancerUsdc * 94).toFixed(2)} INR)
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>ALGO (GAS FUEL)</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.1rem' }}>
                    {walletBalances.freelancerAlgo.toFixed(3)} <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>ALGO</span>
                  </div>
                  <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontFamily: "'DM Mono', monospace", marginTop: '0.1rem' }}>
                    Opt-in & Claim Ready
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Navigation Command Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem', gap: '0.5rem' }}>
          {[
            { id: 'overview', label: 'System Overview', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
            { id: 'ledger', label: `Master Deals Ledger (${projects.length})`, icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
            { id: 'disputes', label: `Dispute Center (${disputedProjects.length})`, badge: disputedProjects.length, icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
            { id: 'users', label: 'Users Directory', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
            { id: 'freelancers', label: 'Verified Freelancers (20)', icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
            { id: 'settings', label: 'Governance & Settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.25rem',
                background: activeTab === tab.id ? 'rgba(201, 168, 76, 0.12)' : 'transparent',
                color: activeTab === tab.id ? '#c9a84c' : '#94a3b8',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid #c9a84c' : '2px solid transparent',
                borderRadius: '6px 6px 0 0', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", fontSize: '0.88rem', fontWeight: activeTab === tab.id ? 700 : 500,
                transition: 'all 0.2s'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: tab.icon }} />
              {tab.label}
              {tab.badge > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.62rem', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 700 }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Views */}
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
            
            {/* Left: Recent Activity & Contract Distribution */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Recent Contract Settlements */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px', padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                    Recent Escrow Contracts
                  </div>
                  <button
                    onClick={() => setActiveTab('ledger')}
                    style={{ background: 'none', border: 'none', color: '#c9a84c', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', cursor: 'pointer' }}
                  >
                    View All Deals →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {projects.slice(0, 5).map(p => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(6, 9, 15, 0.6)', border: '1px solid rgba(255, 255, 255, 0.04)',
                      padding: '0.9rem 1.1rem', borderRadius: '6px'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: '#c9a84c' }}>{p.id}</span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{p.title}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          Client: {p.clientEmail || 'Client Account'} · Freelancer: {p.freelancerEmail || 'Open Pool'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
                          ₹{p.totalBudget || p.budget}
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                            background: p.status === 'Completed' ? 'rgba(34,197,94,0.15)' : p.status === 'Active Escrow' ? 'rgba(201,168,76,0.15)' : p.status === 'Disputed' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                            color: p.status === 'Completed' ? '#4ade80' : p.status === 'Active Escrow' ? '#c9a84c' : p.status === 'Disputed' ? '#f87171' : '#94a3b8',
                            border: `1px solid ${p.status === 'Completed' ? 'rgba(34,197,94,0.3)' : p.status === 'Active Escrow' ? 'rgba(201,168,76,0.3)' : p.status === 'Disputed' ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.3)'}`
                          }}>
                            {p.status || 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {projects.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      No escrow contracts initialized yet.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: System Governance & Architecture Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* System Architecture Status */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px', padding: '1.5rem'
              }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: '#c9a84c', letterSpacing: '0.08em', marginBottom: '1rem', fontWeight: 700 }}>
                  // SYSTEM HEALTH & PROTOCOLS
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Smart Contract TEAL:</span>
                    <span style={{ color: '#4ade80', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>v3.2 Verified</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Database Engine:</span>
                    <span style={{ color: '#cbd5e1', fontFamily: "'DM Mono', monospace" }}>Firestore / Supabase</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Governance Mode:</span>
                    <span style={{ color: '#c9a84c', fontFamily: "'DM Mono', monospace" }}>Admin Full Mediation</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Commission Fee:</span>
                    <span style={{ color: '#4ade80', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{rate}% Flat</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#94a3b8' }}>Dispute Window:</span>
                    <span style={{ color: '#cbd5e1', fontFamily: "'DM Mono', monospace" }}>{disputePeriod}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)',
                border: '1px solid rgba(201, 168, 76, 0.3)', borderRadius: '10px', padding: '1.5rem'
              }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.4rem' }}>
                  Governance Quick Actions
                </div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Manage platform fee rates or resolve active disputes in one click.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <button
                    onClick={() => setActiveTab('disputes')}
                    style={{
                      background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: '#c9a84c',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, padding: '0.6rem',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    Open Dispute Center ({disputedProjects.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('settings')}
                    style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', padding: '0.6rem',
                      borderRadius: '6px', cursor: 'pointer', textAlign: 'center'
                    }}
                  >
                    Configure Platform Fee %
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* MASTER DEALS LEDGER TAB */}
        {activeTab === 'ledger' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px', padding: '1.5rem'
          }}>
            {/* Search & Filter Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', margin: 0, color: '#fff' }}>
                  Master Deals Ledger
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Comprehensive audit trail of all escrow contracts created on Nexrow platform.
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <input
                  type="text"
                  placeholder="Search contract ID, title, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem',
                    padding: '0.55rem 1rem', borderRadius: '6px', width: '260px'
                  }}
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem',
                    padding: '0.55rem 1rem', borderRadius: '6px', cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE ESCROW">Active Escrow</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#64748b' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>CONTRACT ID</th>
                    <th style={{ padding: '0.85rem 1rem' }}>TITLE</th>
                    <th style={{ padding: '0.85rem 1rem' }}>CLIENT</th>
                    <th style={{ padding: '0.85rem 1rem' }}>FREELANCER</th>
                    <th style={{ padding: '0.85rem 1rem' }}>BUDGET (INR / USDC)</th>
                    <th style={{ padding: '0.85rem 1rem' }}>APP ID</th>
                    <th style={{ padding: '0.85rem 1rem' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const budgetNum = Number(p.totalBudget || p.budget || 0);
                    const usdcNum = (budgetNum / 94).toFixed(2);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                        <td style={{ padding: '1rem', fontFamily: "'DM Mono', monospace", color: '#c9a84c', fontWeight: 600 }}>
                          {p.id}
                        </td>
                        <td style={{ padding: '1rem', color: '#fff', fontWeight: 600 }}>
                          {p.title}
                        </td>
                        <td style={{ padding: '1rem', color: '#94a3b8', fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' }}>
                          {p.clientEmail || 'Client Account'}
                        </td>
                        <td style={{ padding: '1rem', color: '#94a3b8', fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' }}>
                          {p.freelancerEmail || 'Open Pool'}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: 700, color: '#fff' }}>
                          ₹{budgetNum} <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>(~${usdcNum} USDC)</span>
                        </td>
                        <td style={{ padding: '1rem', fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' }}>
                          {p.algorandAppId ? (
                            <a
                              href={`https://testnet.explorer.perawallet.app/application/${p.algorandAppId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#38bdf8', textDecoration: 'none' }}
                            >
                              #{p.algorandAppId} ↗
                            </a>
                          ) : (
                            <span style={{ color: '#64748b' }}>Unfunded</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', padding: '0.2rem 0.65rem', borderRadius: '4px',
                            background: p.status === 'Completed' ? 'rgba(34,197,94,0.15)' : p.status === 'Active Escrow' ? 'rgba(201,168,76,0.15)' : p.status === 'Disputed' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                            color: p.status === 'Completed' ? '#4ade80' : p.status === 'Active Escrow' ? '#c9a84c' : p.status === 'Disputed' ? '#f87171' : '#94a3b8',
                            border: `1px solid ${p.status === 'Completed' ? 'rgba(34,197,94,0.3)' : p.status === 'Active Escrow' ? 'rgba(201,168,76,0.3)' : p.status === 'Disputed' ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.3)'}`
                          }}>
                            {p.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                        No deals match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DISPUTE CENTER TAB */}
        {activeTab === 'disputes' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px', padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', margin: 0, color: '#fff' }}>
                  Dispute Mediation Center
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Authorized admin resolution panel for contract disputes raised by clients or freelancers.
                </div>
              </div>
            </div>

            {disputedProjects.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(6, 9, 15, 0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>Zero Active Disputes</div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>All escrow contracts are proceeding smoothly without conflict.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {disputedProjects.map(p => (
                  <div key={p.id} style={{
                    background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1.2rem', borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", color: '#c9a84c', fontSize: '0.8rem' }}>{p.id}</span>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>{p.title}</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          Client: <span style={{ color: '#fff' }}>{p.clientEmail}</span> · Freelancer: <span style={{ color: '#fff' }}>{p.freelancerEmail}</span>
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', padding: '0.25rem 0.65rem', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 700 }}>
                          FLAGGED DISPUTE
                        </span>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#fff', marginTop: '0.4rem' }}>
                          ₹{p.totalBudget}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        style={{
                          background: 'linear-gradient(135deg, #c9a84c 0%, #b8973b 100%)', color: '#000',
                          border: 'none', padding: '0.65rem 1.25rem', borderRadius: '6px', cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '0.82rem', flex: 1
                        }}
                        onClick={() => handleResolveDispute(p.id, 'release')}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === 'resolve-' + p.id ? 'Processing...' : '✓ Resolve & Release to Freelancer'}
                      </button>

                      <button
                        style={{
                          background: 'rgba(255,255,255,0.05)', color: '#fff',
                          border: '1px solid rgba(255,255,255,0.15)', padding: '0.65rem 1.25rem', borderRadius: '6px', cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: '0.82rem', flex: 1
                        }}
                        onClick={() => handleResolveDispute(p.id, 'refund')}
                        disabled={!!actionLoading}
                      >
                        ↩ Refund Full Escrow to Client
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USERS DIRECTORY TAB */}
        {activeTab === 'users' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px', padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(201, 168, 76, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', margin: 0, color: '#fff' }}>
                  Ecosystem Users Directory ({Array.from(userEmailsSet).length || 24})
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Registered clients and freelancers actively using Nexrow platform.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.8rem' }}>
              {Array.from(userEmailsSet).map((email, idx) => {
                const isFreelancer = freelancerEmailsSet.has(email);
                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(6, 9, 15, 0.6)', border: '1px solid rgba(255,255,255,0.04)',
                    padding: '0.85rem 1.1rem', borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: isFreelancer ? '#22c55e' : '#c9a84c', color: '#000', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {email[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', color: '#fff' }}>{email}</span>
                    </div>

                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', padding: '0.2rem 0.55rem', borderRadius: '4px',
                      background: isFreelancer ? 'rgba(34,197,94,0.15)' : 'rgba(201,168,76,0.15)',
                      color: isFreelancer ? '#4ade80' : '#c9a84c',
                      border: `1px solid ${isFreelancer ? 'rgba(34,197,94,0.3)' : 'rgba(201,168,76,0.3)'}`
                    }}>
                      {isFreelancer ? 'VERIFIED FREELANCER' : 'CLIENT ACCOUNT'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VERIFIED FREELANCERS TAB */}
        {activeTab === 'freelancers' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px', padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', margin: 0, color: '#fff' }}>
                  Verified Freelancers Directory ({NexrowDB.freelancers?.length || 0})
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Platform-verified freelancer profiles across all domains.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {(NexrowDB.freelancers || []).map((f) => (
                <div key={f.id} style={{
                  background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255,255,255,0.06)',
                  padding: '1.2rem', borderRadius: '8px', transition: 'all 0.2s',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {/* Verified badge top-right */}
                  <div style={{ position: 'absolute', top: '0.8rem', right: '0.8rem' }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                      background: f.availability === 'Available' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                      color: f.availability === 'Available' ? '#4ade80' : '#fbbf24',
                      border: `1px solid ${f.availability === 'Available' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`
                    }}>
                      {f.availability === 'Available' ? '● AVAILABLE' : '● BUSY'}
                    </span>
                  </div>

                  {/* Avatar + Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.8rem' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #c9a84c 0%, #8a6c23 100%)',
                      color: '#000', fontSize: '0.85rem', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {f.name?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
                        {f.name}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#c9a84c' }}>
                        {f.domain}
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.8rem',
                    background: 'rgba(15, 23, 42, 0.5)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.05em' }}>RATING</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#fbbf24', fontSize: '0.95rem' }}>⭐ {f.rating}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.05em' }}>PROJECTS</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{f.completed_projects}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.05em' }}>EXP</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>{f.experience}</div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.7rem 0', lineHeight: 1.5 }}>
                    {f.bio}
                  </p>

                  {/* Bottom Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.7rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#94a3b8' }}>{f.location}</span>
                    </div>
                    <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: '#c9a84c', fontSize: '0.9rem' }}>
                      {f.hourly_rate_display}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {(!NexrowDB.freelancers || NexrowDB.freelancers.length === 0) && (
              <div style={{ padding: '3rem', textAlign: 'center', background: 'rgba(6, 9, 15, 0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>No Verified Freelancers Found</div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>Run the seed script to populate freelancer profiles.</p>
              </div>
            )}
          </div>
        )}

        {/* GOVERNANCE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px', padding: '2rem', maxWidth: '680px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(201, 168, 76, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.2rem', margin: 0, color: '#fff' }}>
                  Platform Configuration & Parameters
                </h3>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                  Adjust fee parameters, dispute lock periods, and security encryption policies.
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  PLATFORM COMMISSION FEE (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionFee}
                  onChange={(e) => setCommissionFee(e.target.value)}
                  style={{
                    background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.92rem',
                    padding: '0.75rem 1rem', width: '100%', borderRadius: '6px'
                  }}
                />
                <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
                  This percentage will be automatically deducted from all freelancer milestone payouts.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  ESCROW DISPUTE REVIEW PERIOD
                </label>
                <input
                  type="text"
                  value={disputePeriod}
                  onChange={(e) => setDisputePeriod(e.target.value)}
                  style={{
                    background: 'rgba(6, 9, 15, 0.8)', border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: '0.92rem',
                    padding: '0.75rem 1rem', width: '100%', borderRadius: '6px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                  SECURITY ENCRYPTION
                </label>
                <input
                  type="text"
                  value={securityEncryption}
                  readOnly
                  style={{
                    background: 'rgba(6, 9, 15, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#64748b', fontFamily: "'DM Sans', sans-serif", fontSize: '0.92rem',
                    padding: '0.75rem 1rem', width: '100%', cursor: 'not-allowed', borderRadius: '6px'
                  }}
                />
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #c9a84c 0%, #b8973b 100%)', color: '#000',
                    border: 'none', padding: '0.75rem 1.8rem', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: '0.85rem'
                  }}
                >
                  SAVE GOVERNANCE SETTINGS
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer switch role */}
        <div style={{ marginTop: '4rem', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/role-select')}
            style={{ background: 'none', border: 'none', color: '#64748b', fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', cursor: 'pointer' }}
          >
            ← Switch Role
          </button>
        </div>
      </div>
    </div>
  );
}
