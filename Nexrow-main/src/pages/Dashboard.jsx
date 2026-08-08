import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import { AlgorandService } from '../lib/algorand';
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

  // Web3 Wallet States
  const [wallet, setWallet] = useState({ address: '', balance: 0, asaBalance: 0, mnemonic: '' });
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [importText, setImportText] = useState('');
  const [walletMsg, setWalletMsg] = useState(null);

  const isFreelancer = role?.toLowerCase() === 'freelancer';
  const commissionRate = parseFloat(localStorage.getItem('nexrow_commission_fee') || '2.5');
  const getNetDisplayAmount = (amt) => {
    const raw = Number(amt) || 0;
    if (!isFreelancer) return raw;
    return raw * (1 - commissionRate / 100);
  };

  useEffect(() => {
    if (!user) return;
    loadDeals();
    loadWallet();
  }, [user]);

  function loadWallet() {
    try {
      const activeWallet = isFreelancer ? AlgorandService.getFreelancerWallet() : AlgorandService.getClientWallet();
      setWallet(activeWallet);
    } catch (e) {
      console.warn('Failed to load wallet on dashboard init:', e);
    }
  }

  async function handleRefreshBalances() {
    try {
      await AlgorandService.updateBalances();
      loadWallet();
      setWalletMsg({ type: 'success', text: 'Balances updated successfully!' });
      setTimeout(() => setWalletMsg(null), 3000);
    } catch (e) {
      setWalletMsg({ type: 'error', text: 'Balance refresh failed: ' + e.message });
    }
  }

  function handleGenerateNewWallet() {
    if (!window.confirm('This will replace your current wallet. Make sure you copy your current seed phrase if you have funds in it! Click OK to proceed.')) return;
    try {
      const result = isFreelancer ? AlgorandService.generateNewFreelancerWallet() : AlgorandService.generateNewClientWallet();
      loadWallet();
      setWalletMsg({ type: 'success', text: 'New wallet generated successfully!' });
      setTimeout(() => setWalletMsg(null), 4000);
    } catch (e) {
      setWalletMsg({ type: 'error', text: 'Failed to generate wallet: ' + e.message });
    }
  }

  function handleImportWallet() {
    if (!importText.trim()) return;
    try {
      if (isFreelancer) {
        AlgorandService.importFreelancerMnemonic(importText.trim());
      } else {
        AlgorandService.importClientMnemonic(importText.trim());
      }
      loadWallet();
      setImportText('');
      setWalletMsg({ type: 'success', text: 'Wallet imported successfully!' });
      setTimeout(() => setWalletMsg(null), 4000);
    } catch (e) {
      setWalletMsg({ type: 'error', text: 'Import failed: ' + e.message });
    }
  }

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
      const isFreelancerMatch = isFreelancer && (p.freelancerEmail === user.email || p.freelancerEmail === 'Open Pool (Any Freelancer)');
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
              <div className="stat-box"><div className="stat-box-num" style={{color:'var(--gold)'}}>{formatINR(getNetDisplayAmount(mainContract.amount || mainContract.budget || 50000))}</div><div className="stat-box-label">Net Budget</div></div>
              <div className="stat-box"><div className="stat-box-num" style={{fontSize:'1.1rem'}}>{mainContract.deadline || '7 Days'}</div><div className="stat-box-label">Deadline</div></div>
              <div className="stat-box" style={{ minWidth: 0, overflow: 'hidden' }}><div className="stat-box-num" style={{fontSize:'0.8rem', wordBreak: 'break-all'}}>{mainContract.freelancer || 'demo@freelancer.com'}</div><div className="stat-box-label">Freelancer</div></div>
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
            {['all', 'active', 'completed', 'wallet'].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'wallet') handleRefreshBalances();
                }}
              >{tab === 'wallet' ? '💼 Web3 Wallet' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
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
                      <div className="deal-card-amount">{formatINR(getNetDisplayAmount(d.budget || d.amount || d.totalBudget || 0))}</div>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:'0.65rem',color:'var(--text3)'}}>
                        {d.uniqueCode && <span className="deal-code-badge">{d.uniqueCode}</span>} · {formatDate(d.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Web3 Wallet Tab View */}
          {activeTab === 'wallet' && (
            <div className="fade-up" style={{ marginTop: '1.5rem' }}>
              
              {/* Wallet Message alerts */}
              {walletMsg && (
                <div style={{
                  background: walletMsg.type === 'success' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                  border: `1px solid ${walletMsg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: walletMsg.type === 'success' ? 'var(--green)' : 'var(--red)',
                  padding: '0.8rem 1rem', borderRadius: '4px', fontSize: '0.82rem', fontFamily: "'DM Mono', monospace", marginBottom: '1.2rem'
                }}>
                  {walletMsg.text}
                </div>
              )}

              {/* Main Grid: Wallet overview & Import/Generate controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: '1.5rem' }}>
                
                {/* Box 1: Details & Balances */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.08em' }}>// ACTIVE ADDRESS</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', wordBreak: 'break-all', color: '#fff' }}>
                        {wallet.address || 'Loading...'}
                      </span>
                      {wallet.address && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.address);
                            alert('Address copied to clipboard!');
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                    <div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)' }}>ALGO BALANCE</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--gold)', marginTop: '0.15rem' }}>
                        {wallet.balance?.toFixed(4)} ALGO
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)' }}>USDC BALANCE</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--cyan)', marginTop: '0.15rem' }}>
                        {wallet.asaBalance?.toFixed(2)} USDC
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)' }}>
                      {isFreelancer ? 'TOTAL RECEIVED ON PLATFORM' : 'TOTAL ESCROW SPENT ON PLATFORM'}
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--green)', marginTop: '0.15rem' }}>
                      {formatINR(NexrowDB.getUserPayments(wallet.address).reduce((sum, p) => sum + Number(p.amount || 0), 0))}
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'flex', gap: '0.8rem', paddingTop: '1rem' }}>
                    <button className="btn btn-gold btn-sm" style={{ flex: 1, fontSize: '0.72rem' }} onClick={handleRefreshBalances}>
                      🔄 Refresh Balances
                    </button>
                    <a
                      href="https://bank.testnet.algorand.network/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem' }}
                    >
                      🚰 Dispenser / Faucet
                    </a>
                  </div>
                </div>

                {/* Box 2: Keys and Import */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.08em' }}>// SEED PHRASE (25-WORD MNEMONIC)</div>
                    
                    {showMnemonic ? (
                      <div style={{
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                        padding: '0.75rem', borderRadius: '4px', marginTop: '0.3rem',
                        fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', lineHeight: '1.4',
                        color: 'var(--amber)', wordBreak: 'break-word', userSelect: 'all'
                      }}>
                        {wallet.mnemonic || 'No secret mnemonic found (generated/external secret)'}
                      </div>
                    ) : (
                      <div style={{
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                        padding: '0.75rem', borderRadius: '4px', marginTop: '0.3rem',
                        fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: 'var(--text3)',
                        letterSpacing: '0.15em', textAlign: 'center'
                      }}>
                        •••• •••• •••• •••• •••• •••• ••••
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowMnemonic(!showMnemonic)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--gold)',
                        fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', cursor: 'pointer',
                        marginTop: '0.4rem', textDecoration: 'underline', padding: 0
                      }}
                    >
                      {showMnemonic ? 'Hide Secret Phrase' : 'Reveal Secret Phrase'}
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                    <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text2)', marginBottom: '0.35rem' }}>
                      IMPORT MNEMONIC KEYPHRASE
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Enter 25-word phrase..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        style={{
                          flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                          color: '#fff', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem',
                          fontFamily: "'DM Mono', monospace", outline: 'none'
                        }}
                      />
                      <button className="btn btn-gold btn-sm" style={{ fontSize: '0.72rem' }} onClick={handleImportWallet}>
                        Import
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem', marginTop: 'auto' }}>
                    <button className="btn btn-outline btn-full btn-sm" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: '0.72rem' }} onClick={handleGenerateNewWallet}>
                      ⚡ Generate Clean Wallet Keypair
                    </button>
                  </div>
                </div>

              </div>

              {/* Box 3: Transaction history Ledger */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.5rem', borderRadius: '6px', overflowX: 'auto' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '0.8rem', letterSpacing: '0.06em' }}>
                  // TRANSACTION RECONCILIATION LEDGER
                </div>

                {NexrowDB.getUserPayments(wallet.address).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontSize: '0.78rem' }}>
                    No platform payments recorded for this wallet address yet.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem' }}>
                        <th style={{ padding: '0.5rem 0.8rem' }}>TIMESTAMP</th>
                        <th style={{ padding: '0.5rem 0.8rem' }}>RELATION</th>
                        <th style={{ padding: '0.5rem 0.8rem' }}>TRANSACTION TYPE</th>
                        <th style={{ padding: '0.5rem 0.8rem', textAlign: 'right' }}>AMOUNT</th>
                        <th style={{ padding: '0.5rem 0.8rem', textAlign: 'center' }}>TRANSACTION HASH</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NexrowDB.getUserPayments(wallet.address).map(p => {
                        const isIncoming = p.receiver?.toLowerCase() === wallet.address?.toLowerCase();
                        const matchedProj = NexrowDB.projects.find(pr => pr.id === p.projectId);
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '0.7rem 0.8rem', color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem' }}>
                              {formatDate(p.createdAt)}
                            </td>
                            <td style={{ padding: '0.7rem 0.8rem', fontWeight: 600 }}>
                              {matchedProj ? matchedProj.title : 'Secure Milestone'}
                            </td>
                            <td style={{ padding: '0.7rem 0.8rem', fontFamily: "'DM Mono', monospace" }}>
                              <span style={{
                                color: isIncoming ? 'var(--green)' : 'var(--amber)',
                                background: isIncoming ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                                padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.68rem'
                              }}>
                                {isIncoming ? '📥 RECEIVED (INCOMING)' : '📤 SENT (OUTGOING)'}
                              </span>
                            </td>
                            <td style={{ padding: '0.7rem 0.8rem', textAlign: 'right', fontWeight: 700, color: isIncoming ? 'var(--green)' : '#fff' }}>
                              {isIncoming ? '+' : '-'}{formatINR(p.amount)}
                            </td>
                            <td style={{ padding: '0.7rem 0.8rem', textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem' }}>
                              {p.txId ? (
                                <a
                                  href={`https://testnet.algoexplorer.io/tx/${p.txId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--cyan)', textDecoration: 'underline' }}
                                >
                                  {p.txId.slice(0, 8)}...{p.txId.slice(-8)}
                                </a>
                              ) : (
                                <span style={{ color: 'var(--text3)' }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
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
