import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import Navbar from '../components/Navbar';

const STATUS = {
  WAITING_FOR_CLIENT: { label: 'Waiting for Client', badge: 'badge-muted' },
  CLIENT_JOINED:      { label: 'Client Joined',      badge: 'badge-cyan' },
  PENDING:            { label: 'Pending',            badge: 'badge-amber' },
  Pending:            { label: 'Pending',            badge: 'badge-amber' },
  LOCKED:             { label: 'Payment Locked',     badge: 'badge-gold' },
  DELIVERED:          { label: 'Delivered',          badge: 'badge-cyan' },
  VERIFYING:          { label: 'Verifying',          badge: 'badge-amber' },
  RELEASED:           { label: 'Payment Released',   badge: 'badge-green' },
  DISPUTED:           { label: 'Disputed',           badge: 'badge-red' },
};

function escHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatINR(amount) { return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [mainContract, setMainContract] = useState(null);

  const isFreelancer = role?.toLowerCase() === 'freelancer';

  useEffect(() => {
    if (!user) return;
    loadDeals();
  }, [user]);

  async function loadDeals() {
    await NexrowDB.syncFromSupabase(user);

    // Load main contract from localStorage
    const storedRaw = localStorage.getItem('contract');
    if (storedRaw) {
      try { setMainContract(JSON.parse(storedRaw)); } catch (e) {}
    }

    // Collect deals from NexrowDB
    const collected = [];
    const projects = NexrowDB.getProjects();
    projects.forEach(p => {
      const isClientMatch = !isFreelancer && p.clientEmail === user.email;
      const isFreelancerMatch = isFreelancer && p.freelancerEmail === user.email;
      if (isClientMatch || isFreelancerMatch) {
        collected.push({
          id: p.id,
          dealId: p.id,
          uniqueCode: p.id,
          title: p.title,
          description: p.description,
          budget: p.totalBudget,
          createdAt: p.createdAt,
          status: p.status === 'Completed' ? 'RELEASED' : (p.status === 'Active Escrow' ? 'LOCKED' : (p.status === 'Disputed' ? 'DISPUTED' : 'PENDING'))
        });
      }
    });

    setDeals(collected);
    setLoading(false);
  }

  const handleAcceptContract = async () => {
    if (mainContract) {
      const contractId = mainContract.contractId || mainContract.contract_id;
      
      // Update local storage contract
      const updatedContract = {
        ...mainContract,
        freelancer: user?.email,
        status: 'Active Escrow'
      };
      localStorage.setItem('contract', JSON.stringify(updatedContract));
      localStorage.setItem('acceptedContract', JSON.stringify(updatedContract));

      // Update in NexrowDB
      if (contractId) {
        await NexrowDB.updateProject(contractId, {
          freelancerEmail: user?.email,
          freelancerId: user?.id,
          status: 'Active Escrow'
        });

        // Auto-fund milestones for demo escrow hold
        const milestones = NexrowDB.getProjectMilestones(contractId);
        for (const m of milestones) {
          await NexrowDB.updateMilestone(m.id, { paymentStatus: 'FUNDED' });
        }

        navigate(`/status/${contractId}`);
        return;
      }
    }
    navigate('/upload-proof');
  };

  const activeStatuses = ['WAITING_FOR_CLIENT','CLIENT_JOINED','PENDING','Pending','LOCKED','DELIVERED','VERIFYING'];
  const completedStatuses = ['RELEASED','DISPUTED'];

  const filteredDeals = activeTab === 'all' ? deals
    : activeTab === 'active' ? deals.filter(d => activeStatuses.includes(d.status))
    : deals.filter(d => completedStatuses.includes(d.status));

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="dash-header fade-up">
          <div className="dash-greeting">// Welcome back</div>
          <h1 className="dash-title">{isFreelancer ? 'Freelancer Dashboard' : 'Client Dashboard'}</h1>
          <span className="dash-role">Mode: {isFreelancer ? '🛠 Freelancer' : '👤 Client'} · {user?.email}</span>
        </div>

        <div className="stat-row fade-up">
          <div className="stat-box"><div className="stat-box-num">{deals.length}</div><div className="stat-box-label">Total Deals</div></div>
          <div className="stat-box"><div className="stat-box-num">{deals.filter(d => activeStatuses.includes(d.status)).length}</div><div className="stat-box-label">Active</div></div>
          <div className="stat-box"><div className="stat-box-num">{deals.filter(d => d.status === 'RELEASED').length}</div><div className="stat-box-label">Released</div></div>
        </div>

        {/* Freelancer Featured Contract */}
        {isFreelancer && mainContract && (
          <div className="freelancer-contract-card fade-up">
            <div className="flex-between mb-2">
              <span className="mono gold" style={{fontSize:'0.7rem'}}>CONTRACT ID: {mainContract.contractId || mainContract.contract_id || 'NX-DEMO'}</span>
              <span className="badge badge-amber">Status: {mainContract.status || 'Pending'}</span>
            </div>
            <h2 style={{fontSize:'1.3rem', marginBottom:'0.4rem'}}>{mainContract.title || 'Secure Contract'}</h2>
            <p style={{fontSize:'0.85rem', color:'var(--text2)', marginBottom:'1rem'}}>{mainContract.description || ''}</p>
            <div className="stat-row" style={{marginBottom:'1rem'}}>
              <div className="stat-box"><div className="stat-box-num" style={{color:'var(--gold)'}}>{formatINR(mainContract.amount || mainContract.budget || 50000)}</div><div className="stat-box-label">Budget</div></div>
              <div className="stat-box"><div className="stat-box-num" style={{fontSize:'1.1rem'}}>{mainContract.deadline || '7 Days'}</div><div className="stat-box-label">Deadline</div></div>
              <div className="stat-box"><div className="stat-box-num" style={{fontSize:'1.1rem'}}>{mainContract.freelancer || 'demo@freelancer.com'}</div><div className="stat-box-label">Freelancer</div></div>
            </div>
            <button className="btn btn-gold btn-full" onClick={handleAcceptContract}>Accept & Start Work</button>
          </div>
        )}

        <div className="fade-up">
          <div className="deals-header">
            <h3>// Your Deals</h3>
            {!isFreelancer && (
              <Link to="/create-contract" className="btn btn-gold btn-sm">+ New Contract</Link>
            )}
          </div>

          <div className="tabs-row">
            {['all', 'active', 'completed'].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex-center" style={{padding:'3rem'}}><div className="spinner"></div></div>
          ) : filteredDeals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No contracts available</div>
              <div className="empty-sub">{isFreelancer ? '// Waiting for client contract creation' : '// Create a contract to get started'}</div>
            </div>
          ) : (
            <div className="deals-list">
              {filteredDeals.map(d => {
                const s = STATUS[d.status] || STATUS.PENDING;
                return (
                  <Link key={d.id} className="deal-card" to={`/status/${d.id}`}>
                    <div className="deal-card-top">
                      <div>
                        <div className="deal-card-id">{d.dealId || d.uniqueCode || d.id}</div>
                        <div className="deal-card-title">{d.title}</div>
                      </div>
                      <span className={`badge ${s.badge}`}>{s.label}</span>
                    </div>
                    <div className="deal-card-desc">{d.description || ''}</div>
                    <div className="deal-card-bottom">
                      <div className="deal-card-amount">{formatINR(d.budget || d.amount || 0)}</div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.65rem',color:'var(--text3)'}}>
                        {d.uniqueCode && <span className="deal-code-badge">{d.uniqueCode}</span>} · {formatDate(d.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div style={{textAlign:'center',marginTop:'2rem'}}>
          <Link to="/role-select" style={{fontFamily:"'DM Mono',monospace",fontSize:'0.68rem',color:'var(--text3)',textDecoration:'none'}}>← Switch role</Link>
        </div>
      </div>
    </>
  );
}
