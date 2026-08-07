import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import { AlgorandService } from '../lib/algorand';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

function formatINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Status() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const isClient = role?.toLowerCase() === 'client';

  useEffect(() => { loadDeal(); }, [id, user]);

  async function loadDeal() {
    if (!user) return;
    await NexrowDB.syncFromSupabase(user);

    let p = NexrowDB.getProject(id);

    if (!p) {
      const stored = localStorage.getItem('contract');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.contractId === id || parsed.contract_id === id) {
            p = {
              id: parsed.contractId || parsed.contract_id,
              title: parsed.title,
              description: parsed.description,
              freelancerEmail: parsed.freelancer,
              totalBudget: parsed.amount || parsed.budget,
              paymentType: parsed.paymentType || 'Full Payment',
              deadline: parsed.deadline,
              status: parsed.status || 'Pending',
              createdAt: parsed.createdAt,
              algorandAppId: parsed.algorandAppId
            };
          }
        } catch (e) {}
      }
    }

    if (p) {
      setProject(p);
      const ms = NexrowDB.getProjectMilestones(p.id);
      setMilestones(ms);
    }
    setLoading(false);
  }

  // ── ACCEPT CONTRACT (Freelancer) ──
  async function handleAcceptProject() {
    if (!project) return;
    setActionLoading('accept');
    try {
      await NexrowDB.updateProject(project.id, {
        freelancerEmail: user?.email,
        freelancerId: user?.id,
        status: 'Active Escrow'
      });
      const ms = NexrowDB.getProjectMilestones(project.id);
      for (const m of ms) {
        await NexrowDB.updateMilestone(m.id, { paymentStatus: 'FUNDED' });
      }
      setAlert({ type: 'success', message: '✅ Contract accepted! Escrow funds are now locked in Algorand.' });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed: ' + err.message });
    }
    setActionLoading('');
  }

  // ── MARK MILESTONE COMPLETE (Freelancer) ──
  async function handleMarkComplete(milestone) {
    setActionLoading('complete-' + milestone.id);
    try {
      await NexrowDB.updateMilestone(milestone.id, { workflowStatus: 'SUBMITTED' });
      setAlert({ type: 'success', message: `Milestone "${milestone.title}" marked complete. Awaiting client release.` });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed: ' + err.message });
    }
    setActionLoading('');
  }

  // ── RELEASE MILESTONE PAYMENT (Client) ──
  async function handleReleaseMilestone(milestone) {
    setActionLoading('release-' + milestone.id);
    try {
      const client = AlgorandService.getClientWallet();
      const freelancer = AlgorandService.getFreelancerWallet();
      const appId = project.algorandAppId;

      const result = await AlgorandService.releaseMilestone(client.mnemonic, appId, freelancer.address, milestone.amount);
      await NexrowDB.updateMilestone(milestone.id, { workflowStatus: 'COMPLETED', paymentStatus: 'RELEASED' });

      await NexrowDB.createPayment({
        milestoneId: milestone.id,
        projectId: project.id,
        amount: milestone.amount,
        txId: result.txId,
        status: 'COMPLETED',
        sender: client.address,
        receiver: freelancer.address,
        assetId: AlgorandService.assetId
      });

      // Check if ALL milestones are released → complete the project
      const updated = NexrowDB.getProjectMilestones(project.id);
      const allReleased = updated.every(m => m.paymentStatus === 'RELEASED' || m.id === milestone.id);
      if (allReleased) {
        await NexrowDB.updateProject(project.id, { status: 'Completed' });
        setAlert({ type: 'success', message: `🎉 Final milestone released! Project completed. Tx: ${result.txId.slice(0, 12)}...` });
      } else {
        setAlert({ type: 'success', message: `💰 Milestone payment released! Tx: ${result.txId.slice(0, 12)}...` });
      }

      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Release failed: ' + err.message });
    }
    setActionLoading('');
  }

  // ── FUND ESCROW (Client) ──
  async function handleFundEscrow() {
    setActionLoading('fund');
    try {
      const client = AlgorandService.getClientWallet();
      let appId = project.algorandAppId;
      if (!appId) {
        const result = await AlgorandService.createEscrowApp(client.mnemonic, project.totalBudget);
        appId = result.appId;
        await NexrowDB.updateProject(project.id, { algorandAppId: appId });
      }
      await AlgorandService.fundEscrow(client.mnemonic, appId, project.totalBudget);
      await NexrowDB.updateProject(project.id, { status: 'Active Escrow' });
      for (const m of milestones) {
        await NexrowDB.updateMilestone(m.id, { paymentStatus: 'FUNDED' });
      }
      setAlert({ type: 'success', message: `🔒 Escrow funded with ${formatINR(project.totalBudget)}. Funds locked on Algorand!` });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Fund failed: ' + err.message });
    }
    setActionLoading('');
  }

  // ── REFUND (Client) ──
  async function handleRefund() {
    if (!window.confirm('Refund all escrow funds back to you?')) return;
    setActionLoading('refund');
    try {
      const client = AlgorandService.getClientWallet();
      await AlgorandService.refundEscrow(client.mnemonic, project.algorandAppId);
      for (const m of milestones) {
        await NexrowDB.updateMilestone(m.id, { workflowStatus: 'COMPLETED', paymentStatus: 'REFUNDED' });
      }
      await NexrowDB.updateProject(project.id, { status: 'Completed' });
      setAlert({ type: 'success', message: 'Escrow refunded successfully.' });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Refund failed: ' + err.message });
    }
    setActionLoading('');
  }

  // ── DISPUTE ──
  async function handleDispute() {
    if (!window.confirm('Raise a dispute for this contract?')) return;
    setActionLoading('dispute');
    try {
      await AlgorandService.raiseDispute(project.algorandAppId);
      await NexrowDB.updateProject(project.id, { status: 'Disputed' });
      setAlert({ type: 'warning', message: '⚠ Dispute raised! Escrow is frozen.' });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Dispute failed: ' + err.message });
    }
    setActionLoading('');
  }

  async function handleResolveDispute(resolution) {
    if (!window.confirm(`Resolve: ${resolution === 'release' ? 'Release to Freelancer' : 'Refund Client'}?`)) return;
    setActionLoading('resolve');
    try {
      const client = AlgorandService.getClientWallet();
      const freelancer = AlgorandService.getFreelancerWallet();
      if (resolution === 'release') {
        await AlgorandService.releaseEscrow(client.mnemonic, project.algorandAppId, freelancer.address);
        for (const m of milestones) await NexrowDB.updateMilestone(m.id, { workflowStatus: 'COMPLETED', paymentStatus: 'RELEASED' });
      } else {
        await AlgorandService.refundEscrow(client.mnemonic, project.algorandAppId);
        for (const m of milestones) await NexrowDB.updateMilestone(m.id, { workflowStatus: 'COMPLETED', paymentStatus: 'REFUNDED' });
      }
      await NexrowDB.updateProject(project.id, { status: 'Completed' });
      setAlert({ type: 'success', message: 'Dispute resolved.' });
      loadDeal();
    } catch (err) {
      setAlert({ type: 'error', message: 'Resolution failed: ' + err.message });
    }
    setActionLoading('');
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex-center" style={{ minHeight: '60vh' }}>
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Navbar />
        <div className="container">
          <div className="page-wrap" style={{ textAlign: 'center', paddingTop: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h2>Contract Not Found</h2>
            <p className="mt-1">The contract with ID "{id}" could not be found.</p>
            <button className="btn btn-gold mt-2" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
          </div>
        </div>
      </>
    );
  }

  const isCompleted = project.status === 'Completed';
  const isDisputed = project.status === 'Disputed';
  const isEscrowActive = project.status === 'Active Escrow';
  const isPending = !isEscrowActive && !isCompleted && !isDisputed;
  const isMilestoneBased = project.paymentType === 'Milestone-based';

  const fundedAmount = milestones.filter(m => m.paymentStatus === 'FUNDED').reduce((s, m) => s + Number(m.amount), 0);
  const releasedAmount = milestones.filter(m => m.paymentStatus === 'RELEASED').reduce((s, m) => s + Number(m.amount), 0);
  const pendingAmount = isEscrowActive ? (project.totalBudget - releasedAmount) : 0;
  const completedCount = milestones.filter(m => m.workflowStatus === 'COMPLETED' || m.paymentStatus === 'RELEASED').length;

  const clientWallet = AlgorandService.getClientWallet();
  const freelancerWallet = AlgorandService.getFreelancerWallet();

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '760px' }}>
          {alert && <Alert type={alert.type} message={alert.message} />}

          {/* Completed Banner */}
          {isCompleted && (
            <div className="released-banner fade-up">
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <h2 style={{ color: 'var(--green)' }}>Contract Completed</h2>
              <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>All milestones processed. Funds released to freelancer.</p>
            </div>
          )}

          {/* Hero Card */}
          <div className="status-hero fade-up">
            <div className="flex-between mb-2">
              <span className="mono gold" style={{ fontSize: '0.68rem', letterSpacing: '0.12em' }}>CONTRACT: {project.id}</span>
              <span className={`badge ${isCompleted ? 'badge-green' : isDisputed ? 'badge-red' : isEscrowActive ? 'badge-gold' : 'badge-amber'}`}>
                {project.status || 'Pending'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.3rem' }}>{project.title}</h2>
            <div className="status-amount">{formatINR(project.totalBudget)}</div>
            {project.description && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginTop: '0.3rem' }}>{project.description}</p>
            )}
          </div>

          {/* Info Grid */}
          <div className="status-grid fade-up">
            <div className="sg-cell"><div className="sg-label">Payment Type</div><div className="sg-val">{project.paymentType || 'Full Payment'}</div></div>
            <div className="sg-cell"><div className="sg-label">Deadline</div><div className="sg-val">{project.deadline || '—'}</div></div>
            <div className="sg-cell"><div className="sg-label">Freelancer</div><div className="sg-val" style={{ wordBreak: 'break-all', fontSize: '0.78rem' }}>{project.freelancerEmail || 'Open Pool'}</div></div>
            <div className="sg-cell"><div className="sg-label">Created</div><div className="sg-val">{formatDate(project.createdAt)}</div></div>
          </div>

          {/* ── FREELANCER ESCROW TRACKER ── */}
          {!isClient && isEscrowActive && (
            <div className="card fade-up mb-3" style={{ background: 'var(--card)', border: '1px solid var(--gold-dim)', padding: '1.5rem' }}>
              <div className="card-title" style={{ color: 'var(--gold)' }}>// 🔒 YOUR ESCROW TRACKER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '0.8rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>LOCKED IN ESCROW</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--gold)' }}>{formatINR(pendingAmount)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>RELEASED TO YOU</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--green)' }}>{formatINR(releasedAmount)}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>MILESTONES DONE</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--cyan)' }}>{completedCount}/{milestones.length}</div>
                </div>
              </div>
              {isMilestoneBased && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>
                    ESCROW PROGRESS
                  </div>
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--green), var(--gold))',
                      width: `${project.totalBudget > 0 ? (releasedAmount / project.totalBudget) * 100 : 0}%`,
                      transition: 'width 0.6s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)', marginTop: '0.3rem' }}>
                    <span>₹0</span>
                    <span>{formatINR(project.totalBudget)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MILESTONES ── */}
          {milestones.length > 0 && (
            <div className="timeline-wrap fade-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="card-title" style={{ margin: 0 }}>// MILESTONES ({milestones.length})</div>
                {isEscrowActive && (
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>
                    {completedCount}/{milestones.length} complete
                  </span>
                )}
              </div>

              {milestones.map((m, idx) => {
                const isReleased = m.paymentStatus === 'RELEASED';
                const isFunded = m.paymentStatus === 'FUNDED';
                const isRefunded = m.paymentStatus === 'REFUNDED';
                const isSubmitted = m.workflowStatus === 'SUBMITTED';
                const isMComplete = m.workflowStatus === 'COMPLETED' || isReleased;

                return (
                  <div key={m.id} className="milestone-item" style={{
                    borderLeft: `3px solid ${isReleased ? 'var(--green)' : isSubmitted ? 'var(--gold)' : isFunded ? 'var(--amber)' : 'var(--border)'}`,
                    paddingLeft: '1rem'
                  }}>
                    <div className="milestone-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isReleased ? 'var(--green-dim)' : isSubmitted ? 'var(--gold-dim)' : 'var(--surface)',
                          border: `1px solid ${isReleased ? 'var(--green)' : isSubmitted ? 'var(--gold)' : 'var(--border)'}`,
                          fontSize: '0.65rem', fontWeight: 700, color: isReleased ? 'var(--green)' : isSubmitted ? 'var(--gold)' : 'var(--text3)'
                        }}>
                          {isReleased ? '✓' : (idx + 1)}
                        </div>
                        <span className="milestone-title">{m.title}</span>
                      </div>
                      <span className={`badge ${isReleased ? 'badge-green' : isSubmitted ? 'badge-gold' : isRefunded ? 'badge-red' : isFunded ? 'badge-amber' : 'badge-muted'}`}>
                        {isReleased ? 'Released' : isSubmitted ? 'Awaiting Release' : isRefunded ? 'Refunded' : isFunded ? 'Funded' : 'Unfunded'}
                      </span>
                    </div>
                    <div className="milestone-amount">{formatINR(m.amount)}</div>

                    {/* FREELANCER ACTION: Mark milestone complete */}
                    {!isClient && isFunded && !isSubmitted && !isReleased && !isRefunded && !isCompleted && (
                      <div className="milestone-actions">
                        <button
                          className="btn btn-gold"
                          disabled={!!actionLoading}
                          onClick={() => handleMarkComplete(m)}
                          style={{ fontSize: '0.78rem' }}
                        >
                          {actionLoading === 'complete-' + m.id
                            ? <><span className="spinner"></span> Marking...</>
                            : '✅ Mark Milestone Complete'}
                        </button>
                      </div>
                    )}

                    {/* CLIENT ACTION: Release payment after freelancer marks complete */}
                    {isClient && isSubmitted && !isReleased && !isRefunded && !isCompleted && (
                      <div className="milestone-actions">
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--amber)', marginBottom: '0.5rem' }}>
                          ⚠ Freelancer marked this milestone complete. Review and release payment.
                        </div>
                        <button
                          className="btn btn-gold"
                          disabled={!!actionLoading}
                          onClick={() => handleReleaseMilestone(m)}
                          style={{ fontSize: '0.78rem' }}
                        >
                          {actionLoading === 'release-' + m.id
                            ? <><span className="spinner"></span> Releasing...</>
                            : '💰 Release Milestone Payment'}
                        </button>
                      </div>
                    )}

                    {/* FREELANCER: waiting label when submitted */}
                    {!isClient && isSubmitted && !isReleased && (
                      <div className="milestone-actions">
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)' }}>
                          ⏳ Awaiting client payment release...
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── GLOBAL ACTION BUTTONS ── */}
          {!isCompleted && (
            <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.5rem' }}>

              {/* FREELANCER: Accept open contract */}
              {!isClient && isPending && (
                <button className="btn btn-gold btn-full" disabled={!!actionLoading} onClick={handleAcceptProject}>
                  {actionLoading === 'accept' ? <><span className="spinner"></span> Accepting...</> : '🤝 Accept Contract & Lock Escrow'}
                </button>
              )}

              {/* CLIENT: Fund Escrow */}
              {isClient && isPending && !isDisputed && (
                <button className="btn btn-gold btn-full" disabled={!!actionLoading} onClick={handleFundEscrow}>
                  {actionLoading === 'fund' ? <><span className="spinner"></span> Funding...</> : '🔒 Fund Escrow on Algorand'}
                </button>
              )}

              {/* CLIENT: Refund */}
              {isClient && isEscrowActive && (
                <button className="btn btn-outline btn-full" disabled={!!actionLoading} onClick={handleRefund}>
                  {actionLoading === 'refund' ? <><span className="spinner"></span> Refunding...</> : '↩ Refund Escrow to Me'}
                </button>
              )}

              {/* Raise Dispute */}
              {isEscrowActive && !isDisputed && (
                <button
                  className="btn btn-outline btn-full"
                  style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                  disabled={!!actionLoading}
                  onClick={handleDispute}
                >
                  {actionLoading === 'dispute' ? <><span className="spinner"></span> Filing...</> : '⚠ Raise Dispute'}
                </button>
              )}

              {/* Dispute Resolution (Client) */}
              {isDisputed && isClient && (
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <button className="btn btn-gold" style={{ flex: 1 }} disabled={!!actionLoading} onClick={() => handleResolveDispute('release')}>
                    Release to Freelancer
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1 }} disabled={!!actionLoading} onClick={() => handleResolveDispute('refund')}>
                    Refund Client
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Back to Dashboard */}
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
          </div>
        </div>
      </div>
    </>
  );
}
