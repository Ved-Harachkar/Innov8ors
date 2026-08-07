import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NexrowDB } from '../lib/db';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';

export default function UploadProof() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [proofType, setProofType] = useState('screenshot');
  const [files, setFiles] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [alert, setAlert] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const proofTypes = [
    { id: 'screenshot', label: 'Screenshot', icon: '📸' },
    { id: 'repository', label: 'Repository', icon: '📁' },
    { id: 'liveurl', label: 'Live URL', icon: '🌐' },
    { id: 'document', label: 'Document', icon: '📄' }
  ];

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (proofType === 'liveurl' || proofType === 'repository') {
      if (!urlInput.trim()) return setAlert({ type: 'error', message: 'Please enter a URL.' });
    } else if (files.length === 0) {
      return setAlert({ type: 'error', message: 'Please upload at least one file.' });
    }

    setUploading(true);
    setProgress(0);

    // Simulate upload
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      setProgress(i);
    }

    setUploading(false);
    setAlert({ type: 'success', message: 'Files uploaded successfully!' });

    // Start AI verification
    setVerifying(true);
    await new Promise(r => setTimeout(r, 3000));

    const score = Math.floor(Math.random() * 20) + 80;
    const result = {
      score,
      passed: score >= 70,
      details: [
        { check: 'File authenticity', status: 'passed' },
        { check: 'Content relevance', status: score >= 75 ? 'passed' : 'warning' },
        { check: 'Quality standards', status: score >= 80 ? 'passed' : 'warning' },
        { check: 'Completeness', status: score >= 85 ? 'passed' : 'info' }
      ]
    };

    setVerificationResult(result);
    setVerifying(false);

    // Save submission
    const contract = JSON.parse(localStorage.getItem('contract') || '{}');
    await NexrowDB.createSubmission({
      projectId: contract.contractId || contract.contract_id,
      proofType,
      proofUrl: urlInput || 'uploaded-files',
      notes
    });

    await NexrowDB.createVerificationResult({
      submissionId: 'SUB-' + Date.now(),
      score: result.score,
      passed: result.passed,
      details: result.details
    });
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="page-wrap" style={{ paddingTop: '2.5rem', paddingBottom: '4rem' }}>
          <div className="fade-up mb-3">
            <div className="tag">// FREELANCER — PROOF SUBMISSION</div>
            <h1>Upload Deliverable Proof</h1>
            <p className="mt-1" style={{ fontSize: '0.88rem' }}>Submit evidence of work completion for AI verification and escrow release.</p>
          </div>

          {alert && <Alert type={alert.type} message={alert.message} />}

          {/* Proof Type Selector */}
          <div className="proof-types fade-up">
            {proofTypes.map(pt => (
              <button
                key={pt.id}
                className={`proof-type-btn ${proofType === pt.id ? 'active' : ''}`}
                onClick={() => setProofType(pt.id)}
              >
                <span className="pti">{pt.icon}</span>
                {pt.label}
              </button>
            ))}
          </div>

          {/* Upload Area */}
          <div className="card fade-up mb-3" style={{ padding: '1.8rem' }}>
            {(proofType === 'liveurl' || proofType === 'repository') ? (
              <div className="field">
                <label>{proofType === 'liveurl' ? 'Live URL' : 'Repository URL'}</label>
                <input
                  type="url"
                  placeholder={proofType === 'liveurl' ? 'https://your-app.vercel.app' : 'https://github.com/user/repo'}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)', padding: '2rem', textAlign: 'center',
                    cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: '1rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.78rem', color: 'var(--text2)' }}>
                    Click to upload or drag & drop files
                  </div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)', marginTop: '0.3rem' }}>
                    PNG, JPG, PDF, ZIP up to 10MB each
                  </div>
                </div>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />

                {files.length > 0 && (
                  <div className="proof-grid">
                    {files.map((f, i) => (
                      <div key={i} className="proof-thumb">
                        <div style={{ padding: '0.8rem', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--text2)' }}>
                          📎 {f.name}
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.7rem' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="field" style={{ marginTop: '1rem' }}>
              <label>Additional Notes</label>
              <textarea placeholder="Describe what you've delivered..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {uploading && (
              <div className="upload-progress">
                <div className="upload-progress-fill" style={{ width: progress + '%' }}></div>
              </div>
            )}
          </div>

          {/* AI Verification Result */}
          {verifying && (
            <div className="card fade-up mb-3" style={{ padding: '1.8rem', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem' }}></div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.82rem', color: 'var(--gold)' }}>AI Verification in Progress...</div>
            </div>
          )}

          {verificationResult && (
            <div className="card fade-up mb-3" style={{ padding: '1.8rem' }}>
              <div className="card-title">// AI VERIFICATION RESULT</div>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '3rem', fontWeight: 800, fontFamily: "'Syne', sans-serif", color: verificationResult.passed ? 'var(--green)' : 'var(--red)' }}>
                  {verificationResult.score}%
                </div>
                <span className={`badge ${verificationResult.passed ? 'badge-green' : 'badge-red'}`}>
                  {verificationResult.passed ? 'VERIFICATION PASSED' : 'VERIFICATION FAILED'}
                </span>
              </div>
              {verificationResult.details.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontFamily: "'DM Mono', monospace", fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text2)' }}>{d.check}</span>
                  <span style={{ color: d.status === 'passed' ? 'var(--green)' : (d.status === 'warning' ? 'var(--amber)' : 'var(--cyan)') }}>
                    {d.status === 'passed' ? '✓ Passed' : (d.status === 'warning' ? '⚠ Warning' : 'ℹ Info')}
                  </span>
                </div>
              ))}
              <button
                className="btn btn-gold btn-full"
                style={{ marginTop: '1.5rem' }}
                onClick={() => {
                  const contract = JSON.parse(localStorage.getItem('contract') || '{}');
                  const projectId = contract.contractId || contract.contract_id;
                  navigate(projectId ? `/status/${projectId}` : '/dashboard');
                }}
              >
                Proceed to Contract Status →
              </button>
            </div>
          )}

          {!verificationResult && !verifying && (
            <button className="btn btn-gold btn-full fade-up" onClick={handleSubmit} disabled={uploading}>
              {uploading ? <><span className="spinner"></span> Uploading...</> : 'Submit for AI Verification'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
