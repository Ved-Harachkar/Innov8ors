import React, { useState, useEffect } from 'react';

/**
 * FreelancerDashboard Component
 * Fetches contract from localStorage under key "contract", renders Contract Card with Title, Budget, Deadline, Status, and Accept Button
 */
export default function FreelancerDashboard({ onAccept }) {
  const [contract, setContract] = useState(null);

  useEffect(() => {
    // Debug Safety Logs
    console.log("Stored Contract:", localStorage.getItem("contract"));
    const stored = localStorage.getItem("contract");

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log("Parsed Contract:", parsed);
        setContract(parsed);
      } catch (e) {
        console.error("Failed to parse stored contract:", e);
      }
    }
  }, []);

  const handleAccept = () => {
    if (!contract) return;
    localStorage.setItem("acceptedContract", JSON.stringify(contract));

    const isRoot = typeof window !== 'undefined' && !window.location.pathname.includes('/pages/');
    const redirectUrl = isRoot ? 'pages/upload-proof.html' : 'upload-proof.html';

    if (onAccept) {
      onAccept(contract, redirectUrl);
    } else if (typeof window !== 'undefined') {
      window.location.href = redirectUrl;
    }
  };

  if (!contract) {
    return (
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
          <div className="dash-header fade-up">
            <div className="dash-greeting">// FREELANCER PORTAL</div>
            <h1 className="dash-title">Freelancer Dashboard</h1>
          </div>
          <div className="empty-state fade-up" style={{ textAlign: 'center', padding: '3rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📋</div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.9rem', color: 'var(--text2)' }}>
              No contracts available
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-wrap" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
        
        {/* Header */}
        <div className="dash-header fade-up mb-3">
          <div className="dash-greeting">// FREELANCER PORTAL</div>
          <h1 className="dash-title">Freelancer Dashboard</h1>
          <span className="dash-role">Mode: 🛠 Freelancer</span>
        </div>

        {/* Contract Card */}
        <div className="card fade-up mb-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1.8rem' }}>
          <div className="flex-between mb-2">
            <span className="mono gold" style={{ fontSize: '0.72rem', letterSpacing: '0.1em' }}>
              CONTRACT ID: {contract.contractId || contract.contract_id || 'NX-DEMO'}
            </span>
            <span className="badge badge-amber">
              Status: {contract.status || 'Pending'}
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>
            {contract.title || 'Secure Escrow Contract'}
          </h2>
          
          {contract.description && (
            <p style={{ fontSize: '0.88rem', color: 'var(--text2)', marginBottom: '1.5rem' }}>
              {contract.description}
            </p>
          )}

          <div className="stat-row" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-box">
              <div className="stat-box-num" style={{ color: 'var(--gold)' }}>
                ₹ {Number(contract.amount || contract.budget || 50000).toLocaleString('en-IN')}
              </div>
              <div className="stat-box-label">Budget</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-num" style={{ fontSize: '1.1rem' }}>
                {contract.deadline || '7 Days'}
              </div>
              <div className="stat-box-label">Deadline</div>
            </div>
            <div className="stat-box">
              <div className="stat-box-num" style={{ fontSize: '1.1rem' }}>
                {contract.freelancer || 'demo@freelancer.com'}
              </div>
              <div className="stat-box-label">Freelancer</div>
            </div>
          </div>

          {/* Accept Button */}
          <button
            type="button"
            className="btn btn-gold btn-full"
            onClick={handleAccept}
            style={{ padding: '0.9rem 1.5rem', fontSize: '0.88rem' }}
          >
            Accept & Start Work
          </button>
        </div>

      </div>
    </div>
  );
}
