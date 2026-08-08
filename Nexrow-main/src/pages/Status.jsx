import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NexrowDB } from '../lib/db';
import { AlgorandService } from '../lib/algorand';
import Navbar from '../components/Navbar';
import Alert from '../components/Alert';
import { db, doc } from '../lib/firebase';
import { onSnapshot, query, collection, where } from 'firebase/firestore';

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

  const [submittingMilestoneId, setSubmittingMilestoneId] = useState(null);
  const [proofText, setProofText] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofFileData, setProofFileData] = useState('');
  const [previewingFile, setPreviewingFile] = useState(null);
  const [aiReviewingId, setAiReviewingId] = useState(null);

  const isClient = role?.toLowerCase() === 'client';
  const commissionRate = parseFloat(localStorage.getItem('nexrow_commission_fee') || '2.5');
  const getNetDisplayAmount = (amt) => {
    const raw = Number(amt) || 0;
    if (isClient) return raw;
    return raw * (1 - commissionRate / 100);
  };

  const [payments, setPayments] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    loadDeal();

    if (!id || !user) return;

    // 1) Real-time listener for the active contract/project
    const unsubProject = onSnapshot(doc(db, 'projects', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const updatedProject = {
          id: snapshot.id,
          title: data.title,
          description: data.description,
          clientEmail: data.client_email,
          clientId: data.client_id,
          freelancerEmail: data.freelancer_email,
          freelancerId: data.freelancer_id,
          totalBudget: data.total_budget,
          paymentType: data.payment_type,
          deadline: data.deadline,
          status: data.status,
          algorandAppId: data.algorand_app_id,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        setProject(updatedProject);

        // Sync into local cache
        const projIdx = NexrowDB.projects.findIndex(p => p.id === id);
        if (projIdx !== -1) {
          NexrowDB.projects[projIdx] = updatedProject;
        } else {
          NexrowDB.projects.push(updatedProject);
        }
      }
    }, (error) => {
      console.warn('Real-time project listener error:', error);
    });

    // 2) Real-time listener for milestones belonging to this contract
    const qMilestones = query(collection(db, 'milestones'), where('project_id', '==', id));
    const unsubMilestones = onSnapshot(qMilestones, (snapshot) => {
      const updatedMilestones = [];
      snapshot.forEach(docSnap => {
        const mdata = docSnap.data();
        updatedMilestones.push({
          id: docSnap.id,
          projectId: mdata.project_id,
          title: mdata.title,
          description: mdata.description || '',
          amount: mdata.amount,
          orderIndex: mdata.order_index,
          workflowStatus: mdata.workflow_status || 'PENDING',
          paymentStatus: mdata.payment_status || 'UNFUNDED',
          createdAt: mdata.created_at,
          proofText: mdata.proof_text || '',
          proofFileName: mdata.proof_file_name || '',
          proofFileData: mdata.proof_file_data || '',
          aiFeedback: mdata.ai_feedback || '',
          aiStatus: mdata.ai_status || ''
        });
      });

      // Maintain order sequence
      updatedMilestones.sort((a, b) => a.orderIndex - b.orderIndex);

      if (updatedMilestones.length > 0) {
        setMilestones(updatedMilestones);

        // Sync into local cache
        updatedMilestones.forEach(um => {
          const mIdx = NexrowDB.milestones.findIndex(m => m.id === um.id);
          if (mIdx !== -1) {
            NexrowDB.milestones[mIdx] = um;
          } else {
            NexrowDB.milestones.push(um);
          }
        });
      }
    }, (error) => {
      console.warn('Real-time milestones listener error:', error);
    });

    // Clean up connections on route unmount
    return () => {
      unsubProject();
      unsubMilestones();
    };
  }, [id, user]);

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
      const pmts = NexrowDB.getProjectPayments(p.id);
      setPayments(pmts);
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

  // ── SUBMIT MILESTONE PROOF (Freelancer) ──
  async function handleSubmitProof(milestoneId) {
    setActionLoading('submit-proof-' + milestoneId);
    try {
      // 1) Persist the proof to Firestore first
      await NexrowDB.updateMilestone(milestoneId, {
        workflowStatus: 'SUBMITTED',
        proofText: proofText.trim(),
        proofFileName: proofFileName,
        proofFileData: proofFileData,
        aiStatus: 'REVIEWING',
        aiFeedback: ''
      });

      setAlert({ type: 'success', message: '📤 Proof submitted! AI is now analyzing your deliverables...' });
      setSubmittingMilestoneId(null);
      const capturedText = proofText.trim();
      const capturedFileName = proofFileName;
      const capturedFileData = proofFileData;
      setProofText('');
      setProofFileName('');
      setProofFileData('');
      loadDeal();

      // 2) Trigger AI review in the background
      setAiReviewingId(milestoneId);
      setActionLoading('');

      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      let aiResult = null;

      const currentProject = NexrowDB.getProject(id);
      const currentMilestone = NexrowDB.getProjectMilestones(id).find(m => m.id === milestoneId);

      const payload = {
        projectId: id,
        milestoneId,
        projectTitle: currentProject?.title || project.title,
        projectDescription: currentProject?.description || project.description || '',
        milestoneTitle: currentMilestone?.title || '',
        milestoneDescription: currentMilestone?.description || '',
        proofText: capturedText,
        proofFileName: capturedFileName,
        proofFileData: capturedFileData
      };

      // Try n8n webhook first
      if (n8nUrl) {
        try {
          const resp = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (resp.ok) {
            aiResult = await resp.json();
          }
        } catch (webhookErr) {
          console.warn('n8n webhook failed, falling back to Gemini direct call:', webhookErr.message);
        }
      }

      // Fallback: call Gemini API directly from browser
      if (!aiResult && geminiKey) {
        try {
          let proofFileTextContent = '';
          let inlineImageData = null;

          if (capturedFileData) {
            if (capturedFileData.startsWith('data:text/')) {
              try {
                const base64Part = capturedFileData.split(',')[1];
                proofFileTextContent = atob(base64Part).substring(0, 3000);
              } catch (e) {
                proofFileTextContent = '[Could not decode text file]';
              }
            } else if (capturedFileData.startsWith('data:image/')) {
              try {
                const mimeType = capturedFileData.substring(5, capturedFileData.indexOf(';'));
                const base64Part = capturedFileData.split(',')[1];
                inlineImageData = {
                  mimeType,
                  data: base64Part
                };
              } catch (e) {
                console.warn('Could not parse uploaded image for AI:', e);
              }
            }
          }

          const prompt = `You are an impartial AI auditor for a decentralized freelancing platform called Nexrow. Your ONLY job is to determine whether the freelancer's submitted work satisfies the client's requirements for this specific milestone.

--- PROJECT CONTEXT ---
Project Title: ${payload.projectTitle}
Client's Project Requirements: ${payload.projectDescription || '(No description provided)'}

--- MILESTONE DETAILS ---
Milestone Title: ${payload.milestoneTitle}
Milestone Scope: ${payload.milestoneDescription || '(No milestone description provided)'}

--- FREELANCER'S SUBMISSION ---
Submission Notes: ${capturedText || '(No text notes provided)'}
Attached File Name: ${capturedFileName || '(No file attached)'}
${proofFileTextContent ? `Attached Text/Code File Content:\n${proofFileTextContent}` : ''}
${inlineImageData ? 'Attached Image File: An image file is attached to this request and provided to you as input. Please analyze the image content to verify it contains the proof of work matching the requirements.' : ''}

--- YOUR TASK ---
Analyze the freelancer's submission (including notes, text files, or images provided) against the client's requirements and the milestone scope. If no specific requirements are provided, judge based on whether any meaningful work was submitted.

Respond ONLY with a valid JSON object:
{"satisfied":true or false,"reason":"1-3 sentence explanation."}`;

          const contentParts = [];
          if (inlineImageData) {
            contentParts.push({
              inlineData: inlineImageData
            });
          }
          contentParts.push({
            text: prompt
          });

          const gResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: contentParts }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
              })
            }
          );
          if (gResp.ok) {
            const gData = await gResp.json();
            const rawText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            // Extract JSON from the response
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiResult = JSON.parse(jsonMatch[0]);
            }
          }
        } catch (geminiErr) {
          console.warn('Gemini direct call failed:', geminiErr.message);
        }
      }

      // 3) Process AI result
      if (aiResult && typeof aiResult.satisfied === 'boolean') {
        if (aiResult.satisfied) {
          // ✅ AI APPROVED → auto-release payment
          await NexrowDB.updateMilestone(milestoneId, {
            aiStatus: 'APPROVED',
            aiFeedback: aiResult.reason || 'AI verified the submission meets requirements.',
            workflowStatus: 'AI_APPROVED'
          });
          setAlert({ type: 'success', message: '🤖 AI Verified! Deliverables satisfy requirements. Initiating automatic payment release...' });
          loadDeal();

          // Auto-release on-chain payment
          const latestMilestone = NexrowDB.getProjectMilestones(id).find(m => m.id === milestoneId);
          if (latestMilestone && project.algorandAppId) {
            try {
              const client = AlgorandService.getClientWallet();
              const freelancer = AlgorandService.getFreelancerWallet();
              const result = await AlgorandService.releaseMilestone(
                client.mnemonic,
                project.algorandAppId,
                freelancer.address,
                latestMilestone.amount
              );
              await NexrowDB.updateMilestone(milestoneId, { workflowStatus: 'COMPLETED', paymentStatus: 'RELEASED' });
              const rate = parseFloat(localStorage.getItem('nexrow_commission_fee') || '2.5');
              const feeEarned = (Number(latestMilestone.amount) || 0) * (rate / 100);
              const currentEarnings = parseFloat(localStorage.getItem('nexrow_platform_earnings') || '0');
              localStorage.setItem('nexrow_platform_earnings', (currentEarnings + feeEarned).toString());
              await NexrowDB.createPayment({
                milestoneId,
                projectId: id,
                amount: latestMilestone.amount,
                txId: result.txId,
                status: 'COMPLETED',
                sender: client.address,
                receiver: freelancer.address,
                assetId: AlgorandService.assetId
              });
              const updated = NexrowDB.getProjectMilestones(id);
              const allReleased = updated.every(m => m.paymentStatus === 'RELEASED' || m.id === milestoneId);
              if (allReleased) await NexrowDB.updateProject(id, { status: 'Completed' });
              setAlert({ type: 'success', message: `🎉 AI Approved & Payment Auto-Released! Tx: ${result.txId.slice(0, 12)}...` });
            } catch (releaseErr) {
              setAlert({ type: 'warning', message: `🤖 AI Approved but auto-release failed: ${releaseErr.message}. Client can manually release.` });
            }
          } else {
            setAlert({ type: 'success', message: '🤖 AI Approved! Client will be notified to release the payment.' });
          }
        } else {
          // ❌ AI REJECTED → request modifications
          await NexrowDB.updateMilestone(milestoneId, {
            aiStatus: 'REJECTED',
            aiFeedback: aiResult.reason || 'The submission did not meet the requirements.',
            workflowStatus: 'AI_REJECTED'
          });
          setAlert({ type: 'error', message: `🤖 AI Review: Submission needs revision. See feedback on the milestone card.` });
        }
      } else {
        // No AI result → keep as SUBMITTED for manual client review
        await NexrowDB.updateMilestone(milestoneId, { aiStatus: 'MANUAL', aiFeedback: 'AI review unavailable. Awaiting manual client review.' });
        setAlert({ type: 'warning', message: '⚠ AI review unavailable. Your submission is pending manual client review.' });
      }

      loadDeal();
      setAiReviewingId(null);
      return;
    } catch (err) {
      setAlert({ type: 'error', message: 'Submission failed: ' + err.message });
    }
    setActionLoading('');
    setAiReviewingId(null);
  }

  // ── RELEASE MILESTONE PAYMENT (Client) ──
  async function handleReleaseMilestone(milestone) {
    setActionLoading('release-' + milestone.id);
    try {
      const client = AlgorandService.getClientWallet();
      const freelancer = AlgorandService.getFreelancerWallet();
      const appId = project.algorandAppId;

      if (!appId) {
        throw new Error('This contract has not been funded on the Algorand blockchain. Please fund the escrow first.');
      }

      const result = await AlgorandService.releaseMilestone(client.mnemonic, appId, freelancer.address, milestone.amount);
      await NexrowDB.updateMilestone(milestone.id, { workflowStatus: 'COMPLETED', paymentStatus: 'RELEASED' });

      // Track Platform Fee Revenue (e.g. 2.5%)
      const rate = parseFloat(localStorage.getItem('nexrow_commission_fee') || '2.5');
      const feeEarned = (Number(milestone.amount) || 0) * (rate / 100);
      const currentEarnings = parseFloat(localStorage.getItem('nexrow_platform_earnings') || '0');
      localStorage.setItem('nexrow_platform_earnings', (currentEarnings + feeEarned).toString());

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
      console.log('[DEBUG] handleFundEscrow. project details:', project);
      const client = AlgorandService.getClientWallet();
      const budget = Number(project.totalBudget || project.budget || project.amount || 0);

      let appId = project.algorandAppId;
      if (!appId) {
        const result = await AlgorandService.createEscrowApp(client.mnemonic, budget);
        appId = result.appId;
        await NexrowDB.updateProject(project.id, { algorandAppId: appId });
      }
      await AlgorandService.fundEscrow(client.mnemonic, appId, budget);
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
      if (!project.algorandAppId) {
        throw new Error('This contract has not been funded on the Algorand blockchain. No escrow exists.');
      }
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
      if (!project.algorandAppId) {
        throw new Error('This contract has not been funded on the Algorand blockchain. No escrow exists.');
      }
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
      
      if (project.algorandAppId) {
        try {
          if (resolution === 'release') {
            await AlgorandService.releaseEscrow(client.mnemonic, project.algorandAppId, freelancer.address);
          } else {
            await AlgorandService.refundEscrow(client.mnemonic, project.algorandAppId);
          }
        } catch (chainErr) {
          console.warn('On-chain resolution note:', chainErr.message);
        }
      }

      if (resolution === 'release') {
        for (const m of milestones) await NexrowDB.updateMilestone(m.id, { workflowStatus: 'COMPLETED', paymentStatus: 'RELEASED' });
        await NexrowDB.updateProject(project.id, { status: 'Completed' });
      } else {
        for (const m of milestones) await NexrowDB.updateMilestone(m.id, { workflowStatus: 'COMPLETED', paymentStatus: 'REFUNDED' });
        await NexrowDB.updateProject(project.id, { status: 'Refunded' });
      }

      setAlert({ type: 'success', message: `✓ Dispute resolved: ${resolution === 'release' ? 'Funds Released to Freelancer' : 'Escrow Refunded'}` });
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
              <p style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}>All milestones processed. Funds released to freelancer on Algorand blockchain.</p>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => setShowReportModal(true)}
                style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                📜 View On-Chain Transaction Report & Receipt
              </button>
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
            <div className="status-amount">
              {formatINR(getNetDisplayAmount(project.totalBudget))}
              {!isClient && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text2)', marginLeft: '0.6rem', fontFamily: "'DM Mono', monospace", fontWeight: 400 }}>
                  ({commissionRate}% platform fee deducted)
                </span>
              )}
            </div>
            {project.description && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text2)', marginTop: '0.3rem' }}>{project.description}</p>
            )}

            {project.algorandAppId && !isCompleted && (
              <div style={{ marginTop: '1rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowReportModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}
                >
                  📜 View On-Chain Audit & Receipt
                </button>
              </div>
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
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--gold)' }}>{formatINR(getNetDisplayAmount(pendingAmount))}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '0.4rem' }}>RELEASED TO YOU</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--green)' }}>{formatINR(getNetDisplayAmount(releasedAmount))}</div>
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
                    <span>{formatINR(getNetDisplayAmount(project.totalBudget))}</span>
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
                const isAiApproved = m.workflowStatus === 'AI_APPROVED';
                const isAiRejected = m.workflowStatus === 'AI_REJECTED';
                const isMComplete = m.workflowStatus === 'COMPLETED' || isReleased;
                const isAiReviewing = aiReviewingId === m.id;
                const hasAiFeedback = !!m.aiFeedback;

                return (
                  <div key={m.id} className="milestone-item" style={{
                    borderLeft: `3px solid ${isReleased ? 'var(--green)' : isSubmitted ? 'var(--gold)' : isFunded ? 'var(--amber)' : 'var(--border)'}`,
                    paddingLeft: '1rem'
                  }}>
                    <div className="milestone-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isReleased ? 'var(--green-dim)' : isAiApproved ? 'rgba(34,197,94,0.15)' : isAiRejected ? 'rgba(239,68,68,0.12)' : isSubmitted ? 'var(--gold-dim)' : 'var(--surface)',
                          border: `1px solid ${isReleased ? 'var(--green)' : isAiApproved ? 'var(--green)' : isAiRejected ? 'var(--red)' : isSubmitted ? 'var(--gold)' : 'var(--border)'}`,
                          fontSize: '0.65rem', fontWeight: 700, color: isReleased ? 'var(--green)' : isAiApproved ? 'var(--green)' : isAiRejected ? 'var(--red)' : isSubmitted ? 'var(--gold)' : 'var(--text3)'
                        }}>
                          {isReleased ? '✓' : isAiApproved ? '🤖' : isAiRejected ? '✗' : (idx + 1)}
                        </div>
                        <span className="milestone-title">{m.title}</span>
                      </div>
                      <span className={`badge ${isReleased ? 'badge-green' : isAiApproved ? 'badge-green' : isAiRejected ? 'badge-red' : isSubmitted ? 'badge-gold' : isRefunded ? 'badge-red' : isFunded ? 'badge-amber' : 'badge-muted'}`}>
                        {isReleased ? 'Released' : isAiApproved ? '🤖 AI Approved' : isAiRejected ? '🤖 Needs Revision' : isSubmitted ? 'Under Review' : isRefunded ? 'Refunded' : isFunded ? 'Funded' : 'Unfunded'}
                      </span>
                    </div>
                    <div className="milestone-amount">
                      {formatINR(getNetDisplayAmount(m.amount))}
                      {!isClient && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text3)', marginLeft: '0.4rem', fontFamily: "'DM Mono', monospace" }}>
                          (after {commissionRate}% fee)
                        </span>
                      )}
                    </div>

                    {(m.proofText || m.proofFileData) && (
                      <div
                        onClick={() => setPreviewingFile({
                          name: m.proofFileName || 'Submission Details',
                          data: m.proofFileData || '',
                          text: m.proofText || '',
                          title: m.title
                        })}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '0.85rem 1.1rem', borderRadius: '6px', margin: '0.7rem 0',
                          fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'var(--gold)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--gold)', letterSpacing: '0.04em' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            SUBMITTED DELIVERABLES & PROOF
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text3)', fontFamily: "'DM Mono', monospace" }}>
                            👁️ Click to view full details
                          </span>
                        </div>
                        {m.proofText && (
                          <div style={{ color: 'var(--text2)', whiteSpace: 'pre-wrap', lineHeight: 1.4, marginBottom: m.proofFileData ? '0.4rem' : 0 }}>
                            {m.proofText}
                          </div>
                        )}
                        {m.proofFileName && (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewingFile({
                                name: m.proofFileName,
                                data: m.proofFileData || '',
                                text: m.proofText || '',
                                title: m.title
                              });
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                              margin: '0.4rem 0 0.8rem 0', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
                              padding: '0.35rem 0.7rem', borderRadius: '4px', background: 'rgba(255,255,255,0.02)',
                              transition: 'all 0.2s', userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                              e.currentTarget.style.borderColor = 'var(--gold)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                            }}
                          >
                            <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Attached Deliverable:</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 700, textDecoration: 'underline' }}>
                              📁 {m.proofFileName}
                            </span>
                          </div>
                        )}
                        {m.proofFileData && (
                          <div style={{ borderTop: m.proofText ? '1px solid rgba(255,255,255,0.04)' : 'none', paddingTop: m.proofText ? '0.5rem' : 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {m.proofFileData.startsWith('data:image/') ? (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '0.35rem', fontFamily: "'DM Mono', monospace" }}>
                                  🖼️ IMAGE ATTACHMENT:
                                </div>
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewingFile({
                                      name: m.proofFileName || 'Proof Image',
                                      data: m.proofFileData,
                                      text: m.proofText || '',
                                      title: m.title
                                    });
                                  }}
                                  style={{ display: 'block', maxWidth: '300px', cursor: 'pointer', overflow: 'hidden', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                  <img
                                    src={m.proofFileData}
                                    alt="Proof document"
                                    style={{
                                      width: '100%', height: 'auto', display: 'block',
                                      transition: 'opacity 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '0.35rem', fontFamily: "'DM Mono', monospace" }}>
                                  📄 TEXT FILE ATTACHMENT:
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewingFile({
                                        name: m.proofFileName || 'proof.txt',
                                        data: m.proofFileData,
                                        text: m.proofText || '',
                                        title: m.title
                                      });
                                    }}
                                    style={{
                                      background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)',
                                      color: 'var(--cyan)', padding: '0.35rem 0.75rem', borderRadius: '4px',
                                      fontSize: '0.75rem', fontFamily: "'DM Mono', monospace", cursor: 'pointer',
                                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'}
                                  >
                                    👁️ View {m.proofFileName || 'file'}
                                  </button>
                                  <a
                                    href={m.proofFileData}
                                    download={m.proofFileName || 'proof.txt'}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      color: 'var(--text2)', fontSize: '0.75rem', textDecoration: 'none',
                                      fontFamily: "'DM Mono', monospace", display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                                    }}
                                  >
                                    📥 Download
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── AI REVIEWING SPINNER ── */}
                    {isAiReviewing && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.8rem',
                        background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)',
                        padding: '0.85rem 1rem', borderRadius: '6px', margin: '0.7rem 0'
                      }}>
                        <span className="spinner" style={{ width: 16, height: 16, borderColor: 'rgba(139,92,246,0.3)', borderTopColor: '#a78bfa' }} />
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.75rem', color: '#a78bfa' }}>
                          🤖 AI is analyzing your submission against client requirements...
                        </span>
                      </div>
                    )}

                    {/* ── AI FEEDBACK BANNER ── */}
                    {hasAiFeedback && !isAiReviewing && (
                      <div style={{
                        background: isAiApproved ? 'rgba(34,197,94,0.06)' : isAiRejected ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                        border: `1px solid ${isAiApproved ? 'rgba(34,197,94,0.3)' : isAiRejected ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        padding: '0.85rem 1rem', borderRadius: '6px', margin: '0.7rem 0'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontSize: '0.9rem' }}>{isAiApproved ? '✅' : isAiRejected ? '❌' : '⏳'}</span>
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em',
                            color: isAiApproved ? 'var(--green)' : isAiRejected ? 'var(--red)' : 'var(--amber)'
                          }}>
                            AI VERDICT: {isAiApproved ? 'APPROVED' : isAiRejected ? 'REVISION REQUIRED' : 'UNDER REVIEW'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text2)', lineHeight: 1.5 }}>{m.aiFeedback}</p>
                        {isAiRejected && !isClient && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSubmittingMilestoneId(m.id)}
                            style={{ marginTop: '0.6rem', fontSize: '0.72rem', borderColor: 'var(--gold)', color: 'var(--gold)' }}
                          >
                            ✏️ Revise & Resubmit
                          </button>
                        )}
                      </div>
                    )}

                    {/* FREELANCER ACTION: Mark milestone complete with proof */}
                    {!isClient && isFunded && !isSubmitted && !isAiApproved && !isAiRejected && !isReleased && !isRefunded && !isCompleted && milestones.slice(0, idx).every(prev => prev.paymentStatus === 'RELEASED') && (
                      <div className="milestone-actions">
                        {submittingMilestoneId === m.id ? (
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)',
                            padding: '1.2rem', borderRadius: '6px', marginTop: '0.5rem', width: '100%',
                            display: 'flex', flexDirection: 'column', gap: '0.8rem'
                          }}>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                              Submit Proof of Work
                            </div>
                            
                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.3rem', fontFamily: "'DM Mono', monospace" }}>
                                DESCRIPTION OF WORK / NOTES
                              </label>
                              <textarea
                                placeholder="Describe what you completed, code links, or deliverables detail..."
                                value={proofText}
                                onChange={(e) => setProofText(e.target.value)}
                                style={{
                                  width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
                                  color: '#fff', padding: '0.6rem', borderRadius: '4px', fontSize: '0.82rem',
                                  minHeight: '80px', resize: 'vertical'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.3rem', fontFamily: "'DM Mono', monospace" }}>
                                UPLOAD IMAGE OR TEXT FILE (MAX 800KB)
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <input
                                  type="file"
                                  accept="image/*,text/plain"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    if (file.size > 800 * 1024) {
                                      alert("File is too large. Please upload a file smaller than 800 KB.");
                                      e.target.value = null;
                                      return;
                                    }
                                    setProofFileName(file.name);
                                    setProofFileData(''); // Reset content until loaded
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setProofFileData(reader.result);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                  style={{
                                    fontSize: '0.75rem', color: 'var(--text2)',
                                    background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '4px',
                                    border: '1px solid var(--border)', flex: 1
                                  }}
                                />
                                {proofFileName && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.7rem', color: proofFileData ? 'var(--green)' : 'var(--amber)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                                      {proofFileData ? '✓ Loaded' : '⏳ Encoding...'}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setProofFileName('');
                                        setProofFileData('');
                                      }}
                                      style={{
                                        background: 'none', border: 'none', color: 'var(--red)',
                                        fontSize: '0.75rem', cursor: 'pointer', fontFamily: "'DM Mono', monospace"
                                      }}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
                              <button
                                className="btn btn-gold"
                                disabled={!!actionLoading}
                                onClick={() => handleSubmitProof(m.id)}
                                style={{ fontSize: '0.75rem', flex: 1 }}
                              >
                                {actionLoading === 'submit-proof-' + m.id ? 'Submitting...' : '🚀 Submit Deliverables'}
                              </button>
                              <button
                                className="btn btn-outline"
                                onClick={() => {
                                  setSubmittingMilestoneId(null);
                                  setProofText('');
                                  setProofFileName('');
                                  setProofFileData('');
                                }}
                                style={{ fontSize: '0.75rem', flex: 1 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="btn btn-gold"
                            disabled={!!actionLoading}
                            onClick={() => setSubmittingMilestoneId(m.id)}
                            style={{ fontSize: '0.78rem' }}
                          >
                            ✅ Mark Milestone Complete
                          </button>
                        )}
                      </div>
                    )}

                    {/* FREELANCER: Revise & Resubmit option when AI rejected */}
                    {!isClient && isAiRejected && !isReleased && submittingMilestoneId === m.id && (
                      <div className="milestone-actions">
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)',
                          padding: '1.2rem', borderRadius: '6px', marginTop: '0.5rem', width: '100%',
                          display: 'flex', flexDirection: 'column', gap: '0.8rem'
                        }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                            ✏️ Revise Submission
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.3rem', fontFamily: "'DM Mono', monospace" }}>
                              UPDATED DESCRIPTION OF WORK / NOTES
                            </label>
                            <textarea
                              placeholder="Address the AI feedback and describe what you changed..."
                              value={proofText}
                              onChange={(e) => setProofText(e.target.value)}
                              style={{
                                width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)',
                                color: '#fff', padding: '0.6rem', borderRadius: '4px', fontSize: '0.82rem',
                                minHeight: '80px', resize: 'vertical'
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '0.3rem', fontFamily: "'DM Mono', monospace" }}>
                              UPLOAD REVISED FILE (MAX 800KB)
                            </label>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                               <input
                                 type="file"
                                 accept="image/*,text/plain"
                                 onChange={(e) => {
                                   const file = e.target.files[0];
                                   if (!file) return;
                                   if (file.size > 800 * 1024) {
                                     alert('File is too large. Please upload a file smaller than 800 KB.');
                                     e.target.value = null;
                                     return;
                                   }
                                   setProofFileName(file.name);
                                   setProofFileData('');
                                   const reader = new FileReader();
                                   reader.onloadend = () => { setProofFileData(reader.result); };
                                   reader.readAsDataURL(file);
                                 }}
                                 style={{
                                   fontSize: '0.75rem', color: 'var(--text2)',
                                   background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '4px',
                                   border: '1px solid var(--border)', flex: 1
                                 }}
                               />
                               {proofFileName && (
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                   <span style={{ fontSize: '0.7rem', color: proofFileData ? 'var(--green)' : 'var(--amber)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                                     {proofFileData ? '✓ Loaded' : '⏳ Encoding...'}
                                   </span>
                                   <button
                                     onClick={() => {
                                       setProofFileName('');
                                       setProofFileData('');
                                     }}
                                     style={{
                                       background: 'none', border: 'none', color: 'var(--red)',
                                       fontSize: '0.75rem', cursor: 'pointer', fontFamily: "'DM Mono', monospace"
                                     }}
                                   >
                                     Clear
                                   </button>
                                 </div>
                               )}
                             </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
                            <button
                              className="btn btn-gold"
                              disabled={!!actionLoading || !!aiReviewingId}
                              onClick={() => handleSubmitProof(m.id)}
                              style={{ fontSize: '0.75rem', flex: 1 }}
                            >
                              {aiReviewingId === m.id ? '🤖 AI Reviewing...' : '🚀 Resubmit for AI Review'}
                            </button>
                            <button
                              className="btn btn-outline"
                              onClick={() => { setSubmittingMilestoneId(null); setProofText(''); setProofFileName(''); setProofFileData(''); }}
                              style={{ fontSize: '0.75rem', flex: 1 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CLIENT ACTION: Release payment after freelancer marks complete */}
                    {isClient && (isSubmitted || isAiApproved) && !isReleased && !isRefunded && !isCompleted && (
                      <div className="milestone-actions">
                        {project.algorandAppId ? (
                          <>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: isAiApproved ? 'var(--green)' : 'var(--amber)', marginBottom: '0.5rem' }}>
                              {isAiApproved
                                ? '🤖 AI verified this submission satisfies requirements. You may now release payment.'
                                : '⚠ Freelancer marked this milestone complete. Review and release payment.'}
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
                          </>
                        ) : (
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--red)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px' }}>
                            ⚠ This contract has not been funded on-chain. You must click the <strong>"🔒 Fund Escrow on Algorand"</strong> button at the bottom of this page first.
                          </div>
                        )}
                      </div>
                    )}

                    {/* FREELANCER: waiting label when submitted (non-rejected) */}
                    {!isClient && (isSubmitted || isAiApproved) && !isAiRejected && !isReleased && (
                      <div className="milestone-actions">
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: isAiApproved ? 'var(--green)' : 'var(--text2)' }}>
                          {isAiApproved ? '🤖 AI approved! Awaiting client payment release...' : '⏳ Awaiting AI review & client payment release...'}
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
              {isClient && (isPending || !project.algorandAppId) && !isCompleted && !isDisputed && (
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

      {/* ── ON-CHAIN TRANSACTION REPORT MODAL ── */}
      {showReportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
        }}>
          <div className="fade-up" style={{
            background: 'var(--card)', border: '1px solid var(--gold-dim)', borderRadius: '6px',
            maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.2rem' }}>
              <div>
                <div className="nav-logo" style={{ fontSize: '1.3rem', margin: 0 }}>
                  Ne<span>x</span>row Settlement Receipt
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--gold)', marginTop: '0.2rem' }}>
                  // ON-CHAIN VERIFIED AUDIT REPORT
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Smart Contract Audit Bar */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '4px', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', color: 'var(--text3)' }}>ALGORAND SMART CONTRACT APP ID</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)', marginTop: '0.1rem' }}>
                    #{project.algorandAppId || 'N/A'}
                  </div>
                </div>
                {project.algorandAppId && (
                  <a
                    href={`https://testnet.explorer.perawallet.app/application/${project.algorandAppId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--cyan)',
                      background: 'var(--cyan-dim)', padding: '0.4rem 0.8rem', border: '1px solid rgba(56,189,248,0.3)',
                      borderRadius: '3px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
                    }}
                  >
                    View on Pera Wallet Explorer ↗
                  </a>
                )}
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                // FINANCIAL STATEMENT BREAKDOWN
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--surface)', padding: '1rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text2)' }}>Contract Title & ID:</span>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>{project.title} ({project.id})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text2)' }}>Client:</span>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>{project.clientEmail || 'Client Account'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text2)' }}>Freelancer:</span>
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>{project.freelancerEmail || 'Freelancer Account'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text2)' }}>Gross Escrow Budget:</span>
                  <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
                    {formatINR(project.totalBudget)} <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>(~{(project.totalBudget / 94).toFixed(4)} USDC)</span>
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text2)' }}>Platform Fee ({commissionRate}%):</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: 'var(--gold)' }}>
                    {formatINR(project.totalBudget * (commissionRate / 100))}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', fontWeight: 700, color: 'var(--green)', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)' }}>
                  <span>Net Freelancer Payout:</span>
                  <span style={{ fontFamily: "'Syne', sans-serif" }}>
                    {formatINR(project.totalBudget * (1 - commissionRate / 100))}
                  </span>
                </div>
              </div>
            </div>

            {/* Milestones & On-Chain Tx Ledger */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text2)', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                // ON-CHAIN TRANSACTION SETTLEMENT LEDGER
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {milestones.map((m, idx) => {
                  const pmt = payments.find(p => p.milestoneId === m.id);
                  const txId = pmt?.txId;

                  return (
                    <div key={m.id} style={{ background: 'var(--surface)', padding: '0.85rem 1rem', border: '1px solid var(--border)', borderRadius: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Phase {idx + 1}: {m.title}</span>
                        <span className={`badge ${m.paymentStatus === 'RELEASED' ? 'badge-green' : m.paymentStatus === 'FUNDED' ? 'badge-amber' : 'badge-muted'}`}>
                          {m.paymentStatus}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text2)' }}>Amount: {formatINR(m.amount)} (~{(m.amount / 94).toFixed(4)} USDC)</span>
                        {txId ? (
                          <a
                            href={`https://testnet.explorer.perawallet.app/tx/${txId}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--cyan)', fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', textDecoration: 'none' }}
                          >
                            Tx: {txId.slice(0, 10)}... ↗
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontFamily: "'DM Mono', monospace", fontSize: '0.7rem' }}>Tx Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => window.print()}
              >
                🖨️ Print / Download PDF Receipt
              </button>
              <button
                className="btn btn-gold btn-sm"
                onClick={() => setShowReportModal(false)}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── FILE PREVIEW MODAL ── */}
      {previewingFile && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1.5rem'
        }}>
          <div className="fade-up" style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px',
            maxWidth: '800px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)'
            }}>
              <div>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: '#fff', fontSize: '1rem' }}>
                  Preview: {previewingFile.name}
                </span>
              </div>
              <button
                onClick={() => setPreviewingFile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ 
              padding: '1.5rem', 
              overflowY: 'auto', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '1.5rem', 
              background: '#090d16', 
              textAlign: 'left' 
            }}>
              
              {/* Submission Text Notes Section */}
              {previewingFile.text && (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--gold)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                    // FREELANCER SUBMISSION NOTES
                  </div>
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid rgba(255, 255, 255, 0.08)', 
                    padding: '1rem', 
                    borderRadius: '6px', 
                    color: 'var(--text)', 
                    fontSize: '0.88rem', 
                    lineHeight: '1.5', 
                    whiteSpace: 'pre-wrap' 
                  }}>
                    {previewingFile.text}
                  </div>
                </div>
              )}

              {/* Uploaded File Attachment Section */}
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: 'var(--gold)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                  // ATTACHED DELIVERABLE FILE
                </div>
                
                {previewingFile.data ? (
                  previewingFile.data.startsWith('data:image/') ? (
                    <div style={{ display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <img
                        src={previewingFile.data}
                        alt={previewingFile.name}
                        style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '4px' }}
                      />
                    </div>
                  ) : (
                    <pre style={{
                      width: '100%', background: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.08)', padding: '1rem', borderRadius: '6px',
                      color: '#4ade80', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace",
                      whiteSpace: 'pre-wrap', overflowY: 'auto', margin: 0, textAlign: 'left',
                      maxHeight: '40vh'
                    }}>
                      {(() => {
                        try {
                          const parts = previewingFile.data.split(',');
                          return parts.length >= 2 ? atob(parts[1]) : 'Empty file content';
                        } catch (e) {
                          return 'Error reading file content';
                        }
                      })()}
                    </pre>
                  )
                ) : (
                  <div style={{ 
                    padding: '1rem', 
                    textAlign: 'center', 
                    background: 'rgba(255, 255, 255, 0.01)', 
                    border: '1px dashed rgba(255, 255, 255, 0.08)', 
                    borderRadius: '6px', 
                    color: 'var(--text3)', 
                    fontSize: '0.8rem', 
                    fontFamily: "'DM Mono', monospace" 
                  }}>
                    No file attachment uploaded for this milestone.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '0.8rem',
              padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--surface)'
            }}>
              <a
                href={previewingFile.data}
                download={previewingFile.name}
                className="btn btn-gold"
                style={{ fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                📥 Download File
              </a>
              <button
                className="btn btn-outline"
                onClick={() => setPreviewingFile(null)}
                style={{ fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
