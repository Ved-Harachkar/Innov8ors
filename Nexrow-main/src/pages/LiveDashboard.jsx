import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function LiveDashboard() {
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [step, setStep] = useState(0);
  const [cost, setCost] = useState(0);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const stepsList = [
    { label: 'Contract Created', desc: 'Contract initialized and stored in system.' },
    { label: 'AI Verifying Requirements', desc: 'AI agent reviewing scope, deliverables, and rules.' },
    { label: 'Assigning Freelancer', desc: 'Locking funds in escrow vault and notifying provider.' },
    { label: 'Waiting for Submission', desc: 'Escrow active. System awaiting proof upload.' }
  ];

  useEffect(() => {
    try {
      const stored = localStorage.getItem('contract');
      if (stored) {
        setContract(JSON.parse(stored));
      } else {
        setContract({ contractId: 'NX-' + Date.now(), title: 'Full-Stack Web App Escrow', freelancer: 'demo@freelancer.com', amount: 50000, status: 'Pending' });
      }
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const target = Number(contract?.amount || contract?.budget || 50000);
    const timer = setInterval(() => {
      setCost(prev => (prev + 500 <= target ? prev + 500 : target));
    }, 2000);
    return () => clearInterval(timer);
  }, [contract]);

  useEffect(() => {
    const getTime = () => new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logSeq = [
      `[${getTime()}] Contract initialized with ID: ${contract?.contractId || 'NX-DEMO'}`,
      `[${getTime()}] AI validation started. Parsing rules & deliverable constraints.`,
      `[${getTime()}] Freelancer assigned: ${contract?.freelancer || 'demo@freelancer.com'}. Vault locked.`,
      `[${getTime()}] Escrow active. System awaiting deliverable submission from provider.`
    ];
    if (logs.length < step + 1 && logSeq[step]) {
      setLogs(prev => [...prev, logSeq[step]]);
    }
  }, [step, contract]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ maxWidth: '760px', paddingTop: '2.5rem', paddingBottom: '4rem' }}>
          {/* Header */}
          <div className="flex-between mb-3 fade-up">
            <div>
              <div className="tag">// SYSTEM EXECUTION VIEW</div>
              <h1 style={{ fontSize: '1.8rem', marginTop: '0.2rem' }}>Live Escrow Dashboard</h1>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.8rem', borderRadius: '9999px', background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--amber)', fontFamily: "'DM Mono', monospace", fontSize: '0.75rem' }}>
              <span style={{ width: '8px', height: '8px', background: 'var(--amber)', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>{step === 3 ? 'Escrow Active 💰' : 'Task Running ⚙️'}</span>
            </div>
          </div>

          {/* Contract Summary */}
          <div className="card fade-up mb-3" style={{ padding: '1.8rem' }}>
            <div className="flex-between mb-2">
              <span className="mono gold" style={{ fontSize: '0.72rem', letterSpacing: '0.1em' }}>CONTRACT ID: {contract?.contractId || 'NX-DEMO'}</span>
              <span className="badge badge-amber">Status: {step === 3 ? 'Active Escrow' : (contract?.status || 'Pending')}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{contract?.title || 'Secure Escrow Contract'}</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text2)', marginBottom: '1.5rem' }}>{contract?.description || 'Escrow contract execution in progress.'}</p>
            <div className="stat-row" style={{ margin: 0 }}>
              <div className="stat-box"><div className="stat-box-num" style={{ color: 'var(--gold)' }}>₹ {cost.toLocaleString('en-IN')}</div><div className="stat-box-label">Escrow Locked 💰</div></div>
              <div className="stat-box"><div className="stat-box-num" style={{ fontSize: '1.2rem' }}>{contract?.freelancer || 'demo@freelancer.com'}</div><div className="stat-box-label">Assigned Freelancer</div></div>
              <div className="stat-box"><div className="stat-box-num" style={{ fontSize: '1.2rem' }}>{contract?.deadline || '7 Days'}</div><div className="stat-box-label">Target Deadline</div></div>
            </div>
          </div>

          {/* Execution Flow */}
          <div className="card fade-up mb-3" style={{ padding: '1.8rem' }}>
            <div className="card-title">// LIVE EXECUTION FLOW ⚙️</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {stepsList.map((st, idx) => {
                const isCompleted = idx < step;
                const isCurrent = idx === step;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.2rem',
                    background: isCurrent ? 'var(--gold-dim)' : 'var(--surface)',
                    border: `1px solid ${isCurrent ? 'var(--gold)' : (isCompleted ? 'rgba(34,197,94,0.3)' : 'var(--border)')}`,
                    borderRadius: 'var(--radius)', transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: isCompleted ? 'var(--green-dim)' : (isCurrent ? 'var(--gold)' : 'var(--card)'),
                      color: isCompleted ? 'var(--green)' : (isCurrent ? '#000' : 'var(--text3)'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '0.9rem'
                    }}>
                      {isCompleted ? '✔' : (isCurrent ? '⚙️' : '⏳')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '0.95rem', fontWeight: isCurrent ? '700' : '500', color: isCurrent ? 'var(--gold)' : 'var(--text)' }}>
                        [{isCompleted ? '✔' : (isCurrent ? '⚙️' : '⏳')}] {st.label}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.2rem' }}>{st.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Logs */}
          <div className="card fade-up mb-3" style={{ padding: '1.8rem' }}>
            <div className="card-title">// SYSTEM LOGS PANEL 🔥</div>
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', padding: '1.2rem',
              fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: 'var(--text2)',
              maxHeight: '220px', overflowY: 'auto', borderRadius: 'var(--radius)'
            }}>
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '0.5rem', color: i === logs.length - 1 ? 'var(--gold)' : 'var(--text)' }}>{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Action Button */}
          <div className="fade-up">
            <button
              type="button"
              className="btn btn-gold btn-full"
              onClick={() => {
                const contractId = contract?.contractId || contract?.contract_id;
                if (contractId) {
                  navigate(`/status/${contractId}`);
                } else {
                  navigate('/dashboard');
                }
              }}
              style={{ fontSize: '0.85rem', padding: '1rem 2rem' }}
            >
              View Contract Workspace →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
