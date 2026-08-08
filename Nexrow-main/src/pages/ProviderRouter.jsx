import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import Navbar from '../components/Navbar';

const POLICY_OPTIONS = [
  { id: 'quality', label: 'Highest Quality', icon: '⭐', description: 'Prioritize rating & completed projects' },
  { id: 'price', label: 'Lowest Price', icon: '💰', description: 'Prioritize cheapest hourly rate' },
  { id: 'speed', label: 'Fastest Delivery', icon: '⚡', description: 'Prioritize availability & experience' },
  { id: 'balanced', label: 'Balanced', icon: '⚖️', description: 'Weighted mix of quality, price & speed' }
];

function scoreProvider(f, policy) {
  const rating = f.rating || 0;
  const projects = f.completedProjects || 0;
  const rate = f.hourlyRate || 9999;
  const isAvailable = f.availability === 'Available' ? 1 : 0;
  const expYears = parseInt(f.experience) || 0;

  switch (policy) {
    case 'quality':
      return (rating * 20) + (projects * 0.5) + (expYears * 2);
    case 'price':
      return (1 / Math.max(rate, 1)) * 100000 + (rating * 5);
    case 'speed':
      return (isAvailable * 50) + (expYears * 8) + (projects * 0.3) + (rating * 5);
    case 'balanced':
    default:
      return (rating * 12) + (projects * 0.3) + ((1 / Math.max(rate, 1)) * 30000) + (isAvailable * 20) + (expYears * 3);
  }
}

function getLatencyEstimate(f) {
  if (f.availability === 'Available') {
    const exp = parseInt(f.experience) || 1;
    if (exp >= 5) return '~1-2 days';
    if (exp >= 3) return '~2-3 days';
    return '~3-5 days';
  }
  return '~5-7 days';
}

function getMatchScore(f, policy) {
  const score = scoreProvider(f, policy);
  const maxPossible = policy === 'quality' ? 170 : policy === 'price' ? 120 : policy === 'speed' ? 110 : 130;
  return Math.min(99, Math.round((score / maxPossible) * 100));
}

export default function ProviderRouter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState('balanced');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [budgetLimit, setBudgetLimit] = useState('');
  const [searchDomain, setSearchDomain] = useState('');

  // Contract context from CreateContract (passed via state)
  const contractContext = location.state || {};
  const contractTitle = contractContext.title || '';
  const contractBudget = contractContext.budget || 0;

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    await NexrowDB.loadFreelancers();
    const all = NexrowDB.getFreelancers();
    setProviders(all);
    if (contractBudget) setBudgetLimit(String(contractBudget));
    setLoading(false);
  }

  // Filter & sort providers
  const maxBudget = Number(budgetLimit) || Infinity;
  const filtered = providers
    .filter(f => {
      if (searchDomain && !f.domain.toLowerCase().includes(searchDomain.toLowerCase())) return false;
      return true;
    })
    .map(f => ({
      ...f,
      score: scoreProvider(f, selectedPolicy),
      matchPercent: getMatchScore(f, selectedPolicy),
      latency: getLatencyEstimate(f),
      overBudget: f.hourlyRate > maxBudget
    }))
    .sort((a, b) => b.score - a.score);

  const recommended = filtered[0];

  function handleSelectProvider(provider) {
    setSelectedProvider(provider);
  }

  function handleConfirmRoute() {
    if (!selectedProvider) return;
    // Navigate to CreateContract with the selected freelancer pre-filled
    navigate('/create-contract', {
      state: {
        ...contractContext,
        routedProvider: selectedProvider,
        routingPolicy: selectedPolicy
      }
    });
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

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: '860px' }}>

          {/* Header */}
          <div className="page-header fade-up mb-3">
            <div className="tag">// x402 POLICY ENGINE</div>
            <h1>Provider Router</h1>
            <p className="mt-1" style={{ fontSize: '0.88rem', color: 'var(--text2)' }}>
              Intelligent task routing across verified x402 providers. Select a policy to optimize route selection by price, quality, or latency.
            </p>
          </div>

          {contractTitle && (
            <div className="fade-up" style={{
              background: 'var(--surface)', border: '1px solid var(--gold-dim)',
              padding: '0.8rem 1rem', borderRadius: '4px', marginBottom: '1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.08em' }}>ROUTING TASK</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1rem', marginTop: '0.15rem' }}>{contractTitle}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)' }}>BUDGET CEILING</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, color: 'var(--gold)', fontSize: '1.1rem' }}>
                  ₹{Number(contractBudget).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {/* Policy Selector */}
          <div className="fade-up" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>
              // ROUTING POLICY
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
              {POLICY_OPTIONS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPolicy(p.id)}
                  style={{
                    background: selectedPolicy === p.id ? 'rgba(212, 175, 55, 0.12)' : 'var(--surface)',
                    border: `1px solid ${selectedPolicy === p.id ? 'var(--gold)' : 'var(--border)'}`,
                    padding: '0.7rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                    transition: 'all 0.2s', textAlign: 'center',
                    color: selectedPolicy === p.id ? 'var(--gold)' : 'var(--text2)'
                  }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: '0.3rem' }}>{p.icon}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.72rem' }}>{p.label}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.58rem', color: 'var(--text3)', marginTop: '0.15rem' }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="fade-up" style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '0.3rem' }}>
                FILTER BY DOMAIN
              </label>
              <input
                type="text"
                placeholder="e.g. Web Development, UI/UX..."
                value={searchDomain}
                onChange={(e) => setSearchDomain(e.target.value)}
                style={{
                  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '0.55rem 0.8rem', fontSize: '0.82rem',
                  fontFamily: "'DM Mono', monospace", outline: 'none'
                }}
              />
            </div>
            <div style={{ width: '180px' }}>
              <label style={{ display: 'block', fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '0.3rem' }}>
                MAX BUDGET (₹/hr)
              </label>
              <input
                type="number"
                placeholder="No limit"
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(e.target.value)}
                style={{
                  width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '0.55rem 0.8rem', fontSize: '0.82rem',
                  fontFamily: "'DM Mono', monospace", outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Results Header */}
          <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)', letterSpacing: '0.06em' }}>
              // RANKED PROVIDERS ({filtered.length})
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)' }}>
              Policy: {POLICY_OPTIONS.find(p => p.id === selectedPolicy)?.label}
            </div>
          </div>

          {/* Provider List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {filtered.map((f, idx) => {
              const isRecommended = idx === 0;
              const isSelected = selectedProvider?.id === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => handleSelectProvider(f)}
                  className="fade-up"
                  style={{
                    background: isSelected ? 'rgba(212, 175, 55, 0.06)' : isRecommended ? 'rgba(34, 197, 94, 0.04)' : 'var(--card)',
                    border: `1px solid ${isSelected ? 'var(--gold)' : isRecommended ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                    padding: '1rem 1.2rem', borderRadius: '6px', cursor: 'pointer',
                    transition: 'all 0.25s', position: 'relative',
                    opacity: f.overBudget ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--gold-dim)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.borderColor = isRecommended ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)';
                  }}
                >
                  {/* Recommended Badge */}
                  {isRecommended && (
                    <div style={{
                      position: 'absolute', top: '-8px', left: '12px',
                      background: 'var(--green)', color: '#000', fontSize: '0.6rem',
                      fontFamily: "'DM Mono', monospace", fontWeight: 700, padding: '2px 8px',
                      letterSpacing: '0.06em'
                    }}>
                      ⭐ RECOMMENDED ROUTE
                    </div>
                  )}

                  {/* Selected Badge */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: '-8px', right: '12px',
                      background: 'var(--gold)', color: '#000', fontSize: '0.6rem',
                      fontFamily: "'DM Mono', monospace", fontWeight: 700, padding: '2px 8px',
                      letterSpacing: '0.06em'
                    }}>
                      ✓ SELECTED
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: isRecommended ? '0.3rem' : 0 }}>
                    {/* Left: Provider Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem' }}>{f.name}</span>
                        <span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>{f.availability}</span>
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--cyan)', marginTop: '0.2rem' }}>
                        {f.domain}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', marginTop: '0.25rem' }}>
                        {f.experience} exp · {f.completedProjects} projects · {f.location}
                      </div>
                    </div>

                    {/* Right: Metrics */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      {/* Rate */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: 'var(--text3)' }}>RATE</div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '0.9rem', color: f.overBudget ? 'var(--red)' : 'var(--text)' }}>
                          ₹{f.hourlyRate?.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', color: 'var(--text3)' }}>/hour</div>
                      </div>

                      {/* Quality */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: 'var(--text3)' }}>QUALITY</div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '0.9rem', color: 'var(--gold)' }}>
                          {f.rating}/5
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.5rem', color: 'var(--text3)' }}>rating</div>
                      </div>

                      {/* Latency */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: 'var(--text3)' }}>LATENCY</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: '0.78rem', color: f.availability === 'Available' ? 'var(--green)' : 'var(--amber)' }}>
                          {f.latency}
                        </div>
                      </div>

                      {/* Match */}
                      <div style={{ textAlign: 'center', minWidth: '50px' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.55rem', color: 'var(--text3)' }}>MATCH</div>
                        <div style={{
                          fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1rem',
                          color: f.matchPercent >= 85 ? 'var(--green)' : f.matchPercent >= 60 ? 'var(--gold)' : 'var(--amber)'
                        }}>
                          {f.matchPercent}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Over Budget Warning */}
                  {f.overBudget && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--red)', marginTop: '0.4rem' }}>
                      ⚠ Exceeds budget ceiling
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
              No providers match your criteria. Try adjusting filters.
            </div>
          )}

          {/* Action Buttons */}
          <div className="fade-up" style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem' }}>
            <button
              className="btn btn-gold btn-full"
              disabled={!selectedProvider}
              onClick={handleConfirmRoute}
              style={{ fontSize: '0.85rem' }}
            >
              {selectedProvider
                ? `🚀 Route Task to ${selectedProvider.name}`
                : '← Select a Provider Above'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button className="btn btn-outline" onClick={() => navigate('/create-contract')}>
              ← Back to Contract Builder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
