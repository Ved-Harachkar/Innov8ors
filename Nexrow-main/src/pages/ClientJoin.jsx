import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NexrowDB } from '../lib/db';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

function formatINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientJoin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [deal, setDeal] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleLookup = () => {
    if (!code.trim()) return setAlert({ type: 'error', message: 'Please enter a deal code.' });

    setLoading(true);
    setAlert(null);

    // Look up in NexrowDB
    setTimeout(() => {
      const project = NexrowDB.getProject(code.trim().toUpperCase());
      if (project) {
        setDeal(project);
        setAlert({ type: 'success', message: 'Deal found! Review details below.' });
      } else {
        // Try localStorage
        const contracts = JSON.parse(localStorage.getItem('nexrow_contracts') || '[]');
        const found = contracts.find(c =>
          c.contract_id === code.trim() ||
          c.contract_id === code.trim().toUpperCase()
        );
        if (found) {
          setDeal({
            id: found.contract_id,
            title: found.title,
            description: found.description,
            totalBudget: found.total_amount,
            freelancerEmail: found.freelancer_identifier,
            deadline: found.deadline,
            status: found.contract_status
          });
          setAlert({ type: 'success', message: 'Deal found! Review details below.' });
        } else {
          setAlert({ type: 'error', message: 'Deal code not found. Please check and try again.' });
        }
      }
      setLoading(false);
    }, 800);
  };

  const handleJoin = async () => {
    if (!deal) return;
    setJoining(true);

    // Simulate joining
    await new Promise(r => setTimeout(r, 1500));

    setAlert({ type: 'success', message: 'Successfully joined! Redirecting to contract...' });
    setTimeout(() => {
      navigate(`/status/${deal.id}`);
    }, 1000);
  };

  return (
    <>
      <Navbar />
      <div className="join-wrap">
        <div className="fade-up mb-3" style={{ textAlign: 'center' }}>
          <div className="tag">// CLIENT — JOIN DEAL</div>
          <h1 style={{ fontSize: '1.6rem' }}>Enter Deal Code</h1>
          <p className="mt-1" style={{ fontSize: '0.82rem' }}>Enter the unique code shared by the freelancer to join the escrow deal.</p>
        </div>

        {alert && <Alert type={alert.type} message={alert.message} />}

        <div className="code-input-wrap fade-up">
          <input
            type="text"
            className="code-input"
            placeholder="SUPX-12345"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={20}
          />
          <button
            className="btn btn-gold btn-full"
            style={{ marginTop: '1rem' }}
            onClick={handleLookup}
            disabled={loading}
          >
            {loading ? <><span className="spinner"></span> Looking up...</> : 'Look Up Deal'}
          </button>
        </div>

        {/* Deal Preview */}
        {deal && (
          <div className="card fade-up" style={{ padding: '1.5rem' }}>
            <div className="flex-between mb-2">
              <span className="mono gold" style={{ fontSize: '0.7rem' }}>DEAL: {deal.id}</span>
              <span className="badge badge-amber">{deal.status || 'Pending'}</span>
            </div>
            <h3 style={{ marginBottom: '0.3rem' }}>{deal.title}</h3>
            {deal.description && <p style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>{deal.description}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div className="sg-label">Amount</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: 'var(--gold)', fontSize: '1.3rem' }}>
                  {formatINR(deal.totalBudget)}
                </div>
              </div>
              <div>
                <div className="sg-label">Deadline</div>
                <div className="sg-val">{deal.deadline || '—'}</div>
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={handleJoin} disabled={joining}>
              {joining ? <><span className="spinner"></span> Joining...</> : 'Join & Lock Payment'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
