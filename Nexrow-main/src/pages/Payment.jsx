import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

function formatINR(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Payment() {
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [method, setMethod] = useState('escrow');
  const [processing, setProcessing] = useState(false);
  const [alert, setAlert] = useState(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('contract');
      if (stored) setContract(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const methods = [
    { id: 'escrow', icon: '🔒', name: 'Algorand Escrow', desc: 'On-chain smart contract escrow' },
    { id: 'upi', icon: '📱', name: 'UPI / IMPS', desc: 'Instant bank transfer (simulated)' },
    { id: 'card', icon: '💳', name: 'Credit / Debit Card', desc: 'Visa, Mastercard (simulated)' }
  ];

  const handlePay = async () => {
    setProcessing(true);
    setAlert(null);

    // Simulate payment
    await new Promise(r => setTimeout(r, 2500));

    setProcessing(false);
    setCompleted(true);
    setAlert({ type: 'success', message: 'Payment processed successfully! Funds locked in escrow.' });
  };

  const amount = contract?.amount || contract?.budget || 50000;

  return (
    <>
      <Navbar />
      <div className="pay-wrap">
        <div className="fade-up mb-3" style={{ textAlign: 'center' }}>
          <div className="tag">// PAYMENT GATEWAY</div>
          <h1 style={{ fontSize: '1.6rem' }}>Secure Payment</h1>
        </div>

        {alert && <Alert type={alert.type} message={alert.message} />}

        {/* Summary */}
        <div className="pay-summary fade-up">
          <div className="pay-row">
            <span className="pay-row-key">Contract</span>
            <span className="pay-row-val">{contract?.title || 'Nexrow Contract'}</span>
          </div>
          <div className="pay-row">
            <span className="pay-row-key">Freelancer</span>
            <span className="pay-row-val">{contract?.freelancer || 'demo@freelancer.com'}</span>
          </div>
          <div className="pay-row">
            <span className="pay-row-key">Amount</span>
            <span className="pay-row-val big">{formatINR(amount)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        {!completed && (
          <>
            <div className="pay-methods fade-up">
              {methods.map(m => (
                <div
                  key={m.id}
                  className={`pay-method ${method === m.id ? 'selected' : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  <span className="pay-method-icon">{m.icon}</span>
                  <div>
                    <div className="pay-method-name">{m.name}</div>
                    <div className="pay-method-desc">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pay-sim-note fade-up">
              ⚠ This is a simulation. No real payment is processed.
            </div>

            <button className="btn btn-gold btn-full fade-up" onClick={handlePay} disabled={processing}>
              {processing ? <><span className="spinner"></span> Processing...</> : `Pay ${formatINR(amount)}`}
            </button>
          </>
        )}

        {completed && (
          <div className="fade-up" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>✅</div>
            <h3 style={{ color: 'var(--green)', marginBottom: '1rem' }}>Payment Successful</h3>
            <button className="btn btn-gold" onClick={() => navigate('/dashboard')}>
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
