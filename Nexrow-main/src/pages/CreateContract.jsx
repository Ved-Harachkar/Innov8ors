import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import { AlgorandService } from '../lib/algorand';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

export default function CreateContract() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routedState = location.state || {};
  const routedProvider = routedState.routedProvider || null;

  const [formData, setFormData] = useState({
    title: routedState.title || '',
    description: routedState.description || '',
    amount: routedState.budget || '',
    paymentType: routedState.paymentType || 'Full Payment',
    deadline: routedState.deadline || ''
  });

  const [milestones, setMilestones] = useState(routedState.milestones || [
    { title: 'Phase 1 — Setup & Initial Deliverable', amount: '', description: '' },
    { title: 'Phase 2 — Full Development', amount: '', description: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMilestoneChange = (index, field, value) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { title: `Phase ${milestones.length + 1} — Deliverable`, amount: '' }
    ]);
  };

  const removeMilestone = (index) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return window.alert('Enter contract title');
    if (!formData.description.trim()) return window.alert('Enter description');
    if (!formData.amount || Number(formData.amount) <= 0) return window.alert('Invalid amount');
    if (!formData.deadline) return window.alert('Select deadline');

    if (formData.paymentType === 'Milestone-based') {
      const totalMilestoneSum = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      if (milestones.some(m => !m.title.trim() || !m.amount || Number(m.amount) <= 0)) {
        return window.alert('Please fill out all milestone titles and amounts.');
      }
      if (totalMilestoneSum !== Number(formData.amount)) {
        return window.alert(`Total milestone amount (₹${totalMilestoneSum}) must equal the contract total budget (₹${formData.amount}).`);
      }
    }

    setLoading(true);
    setAlert({ type: 'success', message: 'Contract Created Successfully 🚀' });

    try {
      let algorandAppId = null;
      try {
        const client = AlgorandService.getClientWallet();
        const result = await AlgorandService.createEscrowApp(client.mnemonic, Number(formData.amount));
        algorandAppId = result.appId;
      } catch (e) { console.warn('Algorand app creation skipped:', e); }

      const project = await NexrowDB.createProject({
        title: formData.title,
        description: formData.description,
        clientEmail: user?.email,
        clientId: user?.id,
        freelancerEmail: routedProvider ? routedProvider.email : 'Open Pool (Any Freelancer)',
        totalBudget: Number(formData.amount),
        paymentType: formData.paymentType,
        deadline: formData.deadline,
        algorandAppId
      });

      if (formData.paymentType === 'Milestone-based') {
        for (let i = 0; i < milestones.length; i++) {
          await NexrowDB.createMilestone({
            projectId: project.id,
            title: milestones[i].title,
            amount: Number(milestones[i].amount),
            description: milestones[i].description || '',
            orderIndex: i
          });
        }
      }

      setTimeout(() => {
        setLoading(false);
        navigate('/live-dashboard');
      }, 1000);

    } catch (err) {
      console.error('Contract creation failed:', err);
      setLoading(false);
      setAlert({ type: 'error', message: 'Contract creation failed: ' + err.message });
    }
  };

  const calculatedMilestoneSum = milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  const totalAmount = Number(formData.amount) || 0;

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
          <div className="page-header fade-up mb-3">
            <div className="tag">// CLIENT — ESCROW DEPOSIT</div>
            <h1>Create Secure Contract</h1>
            <p className="mt-1" style={{ fontSize: '0.88rem' }}>
              Define contract scope and lock payment in escrow. Verified release upon completion.
            </p>
          </div>

          {alert && <Alert type={alert.type} message={alert.message} />}

          <form onSubmit={handleSubmit}>
            {/* Overview Section */}
            <div className="form-section fade-up">
              <div className="form-section-title">1. Contract Overview</div>

              {/* x402 Policy Router Widget */}
              {routedProvider ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--gold-dim)',
                  padding: '0.85rem 1.1rem', borderRadius: '6px', marginBottom: '1.2rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
                      🤖 x402 ROUTED PROVIDER
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginTop: '0.15rem' }}>
                      {routedProvider.name} ({routedProvider.email})
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)' }}>
                      Policy: {routedState.routingPolicy === 'balanced' ? 'Balanced Routing' : routedState.routingPolicy === 'price' ? 'Cost Optimized' : routedState.routingPolicy === 'quality' ? 'Quality Optimized' : 'Speed Optimized'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/provider-router', { state: { title: formData.title, budget: formData.amount, description: formData.description, paymentType: formData.paymentType, deadline: formData.deadline, milestones } })}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.72rem' }}
                  >
                    Change Route
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed var(--border)',
                  padding: '0.85rem 1.1rem', borderRadius: '6px', marginBottom: '1.2rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.05em' }}>
                      🤖 x402 ROUTED PROVIDER
                    </div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: 'var(--text2)', marginTop: '0.15rem' }}>
                      Open Pool (Any Freelancer)
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/provider-router', { state: { title: formData.title, budget: formData.amount, description: formData.description, paymentType: formData.paymentType, deadline: formData.deadline, milestones } })}
                    className="btn btn-gold btn-sm"
                    style={{ fontSize: '0.72rem', background: 'var(--gold)', color: '#000' }}
                  >
                    🔍 Run x402 Policy Router
                  </button>
                </div>
              )}

              <div className="field">
                <label>Contract Title</label>
                <input type="text" name="title" placeholder="e.g. Full-Stack Web App Development" value={formData.title} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Project Description</label>
                <textarea name="description" placeholder="Describe key scope, deliverables, technical stack, and milestone breakdown..." value={formData.description} onChange={handleChange} />
              </div>
            </div>

            {/* Payment & Milestones Section */}
            <div className="form-section fade-up">
              <div className="form-section-title">2. Payment & Milestones</div>
              <div className="field">
                <label>Total Payment Amount (INR)</label>
                <div className="amount-wrap">
                  <span className="amount-prefix">₹</span>
                  <input type="number" name="amount" placeholder="50000" min="1" value={formData.amount} onChange={handleChange} />
                </div>
              </div>
              <div className="field">
                <label>Payment Type</label>
                <select name="paymentType" value={formData.paymentType} onChange={handleChange}>
                  <option value="Full Payment">Full Payment</option>
                  <option value="Milestone-based">Milestone (Milestone-based)</option>
                </select>
              </div>

              {/* Dynamic Milestone Builder */}
              {formData.paymentType === 'Milestone-based' && (
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.2rem' }}>
                  <div className="flex-between mb-2">
                    <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.1em' }}>
                      BREAKDOWN MILESTONES
                    </label>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: calculatedMilestoneSum === totalAmount && totalAmount > 0 ? 'var(--green)' : 'var(--amber)' }}>
                      Sum: ₹{calculatedMilestoneSum} / ₹{totalAmount}
                    </span>
                  </div>

                  {milestones.map((m, idx) => (
                    <div key={idx} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      padding: '1rem',
                      borderRadius: '6px',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 38px', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <input
                          type="text"
                          placeholder={`Milestone ${idx + 1} Title`}
                          value={m.title}
                          onChange={(e) => handleMilestoneChange(idx, 'title', e.target.value)}
                          style={{
                            background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
                            fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', padding: '0.7rem 0.9rem', outline: 'none'
                          }}
                        />
                        <div className="amount-wrap">
                          <span className="amount-prefix">₹</span>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={m.amount}
                            onChange={(e) => handleMilestoneChange(idx, 'amount', e.target.value)}
                            style={{
                              background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
                              fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', padding: '0.7rem 0.9rem 0.7rem 2rem', outline: 'none'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMilestone(idx)}
                          disabled={milestones.length <= 1}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#ef4444',
                            height: '42px',
                            width: '38px',
                            cursor: milestones.length <= 1 ? 'not-allowed' : 'pointer',
                            opacity: milestones.length <= 1 ? 0.3 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: "'DM Mono', monospace",
                            fontSize: '0.85rem',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div>
                        <textarea
                          placeholder={`Specify detailed requirements/scope for Phase ${idx + 1}...`}
                          value={m.description || ''}
                          onChange={(e) => handleMilestoneChange(idx, 'description', e.target.value)}
                          style={{
                            width: '100%',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            fontFamily: "'DM Mono', monospace",
                            fontSize: '0.78rem',
                            padding: '0.6rem 0.8rem',
                            minHeight: '60px',
                            resize: 'vertical',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={addMilestone}
                    style={{ marginTop: '0.4rem', width: '100%' }}
                  >
                    + Add Milestone Phase
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Section */}
            <div className="form-section fade-up">
              <div className="form-section-title">3. Schedule & Terms</div>
              <div className="field">
                <label>Deadline</label>
                <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} />
              </div>
            </div>

            {/* Terms */}
            <div className="fade-up mb-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '1rem 1.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input type="checkbox" required style={{ width: '18px', height: '18px', accentColor: 'var(--gold)' }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--text)' }}>
                  I agree to Nexrow secure escrow terms and conditions
                </span>
              </label>
            </div>

            {/* Submit */}
            <div className="fade-up" style={{ display: 'flex', gap: '0.8rem' }}>
              <button type="submit" className="btn btn-gold btn-full" disabled={loading}>
                {loading && <span className="spinner"></span>}
                {loading ? ' Creating Contract...' : 'Create Secure Contract'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
