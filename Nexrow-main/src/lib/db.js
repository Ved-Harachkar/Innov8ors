/**
 * NexrowDB — In-memory database cache with Firebase Firestore sync fallback
 * Provides CRUD for projects, milestones, submissions, payments, and verification results
 */
import { db, doc, getDoc, setDoc } from './firebase';
import { collection, getDocs, query, where, addDoc, updateDoc } from 'firebase/firestore';

class NexrowDBClass {
  constructor() {
    this.projects = [];
    this.milestones = [];
    this.submissions = [];
    this.payments = [];
    this.verificationResults = [];
    this.freelancers = [];
    this._synced = false;
  }

  // ── SYNC FROM FIRESTORE ──
  async syncFromSupabase(user) { // Retaining method signature for backwards compatibility
    if (!user) return;
    try {
      if (db) {
        let projectDocs = [];
        if (user.id === 'admin_sys' || user.email?.toLowerCase().includes('admin')) {
          const snapAll = await getDocs(collection(db, 'projects')).catch(() => ({ docs: [] }));
          projectDocs = snapAll.docs || [];
        } else {
          const q1 = query(collection(db, 'projects'), where('client_id', '==', user.id));
          const q2 = query(collection(db, 'projects'), where('freelancer_email', '==', user.email));
          const q3 = query(collection(db, 'projects'), where('freelancer_email', '==', 'Open Pool (Any Freelancer)'));
          
          const [snap1, snap2, snap3] = await Promise.all([
            getDocs(q1).catch(() => ({ docs: [] })),
            getDocs(q2).catch(() => ({ docs: [] })),
            getDocs(q3).catch(() => ({ docs: [] }))
          ]);
          projectDocs = [...(snap1.docs || []), ...(snap2.docs || []), ...(snap3.docs || [])];
        }
        const loadedProjects = [];

        projectDocs.forEach(d => {
          const data = d.data();
          if (!loadedProjects.find(p => p.id === d.id)) {
            loadedProjects.push({
              id: d.id,
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
            });
          }
        });

        if (loadedProjects.length > 0) {
          this.projects = loadedProjects;
          
          // Fetch milestones for all loaded projects
          const projectIds = loadedProjects.map(p => p.id);
          const loadedMilestones = [];
          await Promise.all(projectIds.map(async (pid) => {
            const mq = query(collection(db, 'milestones'), where('project_id', '==', pid));
            const mSnap = await getDocs(mq).catch(() => ({ docs: [] }));
            mSnap.docs.forEach(md => {
              const mdata = md.data();
              if (!loadedMilestones.find(m => m.id === md.id)) {
                loadedMilestones.push({
                  id: md.id,
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
              }
            });
          }));
           if (loadedMilestones.length > 0) {
            this.milestones = loadedMilestones;
          }

          // Fetch payments for all loaded projects
          const loadedPayments = [];
          await Promise.all(projectIds.map(async (pid) => {
            const pq = query(collection(db, 'payments'), where('project_id', '==', pid));
            const pSnap = await getDocs(pq).catch(() => ({ docs: [] }));
            pSnap.docs.forEach(pd => {
              const pdata = pd.data();
              if (!loadedPayments.find(p => p.id === pd.id)) {
                loadedPayments.push({
                  id: pd.id,
                  milestoneId: pdata.milestone_id,
                  projectId: pdata.project_id,
                  amount: pdata.amount,
                  txId: pdata.tx_id,
                  status: pdata.status || 'COMPLETED',
                  sender: pdata.sender || null,
                  receiver: pdata.receiver || null,
                  assetId: pdata.asset_id || null,
                  createdAt: pdata.created_at
                });
              }
            });
          }));
          if (loadedPayments.length > 0) {
            this.payments = loadedPayments;
          }
        }
      }
      this._synced = true;
    } catch (e) {
      console.warn('NexrowDB sync failed, using local cache:', e);
    }

    this._loadLocalStorage();
  }

  _loadLocalStorage() {
    try {
      const contracts = JSON.parse(localStorage.getItem('nexrow_contracts') || '[]');
      contracts.forEach(c => {
        if (!this.projects.find(p => p.id === c.contract_id)) {
          this.projects.push({
            id: c.contract_id,
            title: c.title,
            description: c.description,
            clientEmail: c.client_email,
            freelancerEmail: c.freelancer_identifier,
            totalBudget: c.total_amount,
            paymentType: c.payment_type,
            deadline: c.deadline,
            status: c.contract_status || 'Pending',
            createdAt: c.created_at
          });
        }
      });
    } catch (e) { /* ignore */ }
  }

  // ── PROJECT OPERATIONS ──
  getProjects() { return [...this.projects]; }

  getProject(id) {
    return this.projects.find(p => p.id === id) || null;
  }

  async createProject(data) {
    const project = {
      id: data.id || 'NX-' + Date.now(),
      title: data.title,
      description: data.description,
      clientEmail: data.clientEmail,
      clientId: data.clientId,
      freelancerEmail: data.freelancerEmail,
      freelancerId: data.freelancerId,
      totalBudget: data.totalBudget,
      paymentType: data.paymentType || 'Full Payment',
      deadline: data.deadline,
      status: data.status || 'Pending',
      algorandAppId: data.algorandAppId,
      createdAt: new Date().toISOString()
    };
    this.projects.push(project);

    // Sync to Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'projects', project.id), {
          title: project.title,
          description: project.description,
          client_email: project.clientEmail,
          client_id: project.clientId,
          freelancer_email: project.freelancerEmail,
          freelancer_id: project.freelancerId || null,
          total_budget: project.totalBudget,
          payment_type: project.paymentType,
          deadline: project.deadline,
          status: project.status,
          algorand_app_id: project.algorandAppId || null,
          created_at: project.createdAt
        });
      }
    } catch (e) {
      console.warn('Firestore project insert failed:', e);
      throw new Error('Firestore project sync failed: ' + e.message);
    }

    // Save to localStorage
    const contracts = JSON.parse(localStorage.getItem('nexrow_contracts') || '[]');
    contracts.push({
      contract_id: project.id,
      title: project.title,
      description: project.description,
      client_email: project.clientEmail,
      freelancer_identifier: project.freelancerEmail,
      total_amount: project.totalBudget,
      payment_type: project.paymentType,
      deadline: project.deadline,
      contract_status: project.status,
      created_at: project.createdAt
    });
    localStorage.setItem('nexrow_contracts', JSON.stringify(contracts));
    localStorage.setItem('contract', JSON.stringify({
      contractId: project.id,
      title: project.title,
      description: project.description,
      freelancer: project.freelancerEmail,
      amount: project.totalBudget,
      paymentType: project.paymentType,
      deadline: project.deadline,
      status: project.status,
      createdAt: project.createdAt
    }));

    return project;
  }

  async updateProject(id, updates) {
    const idx = this.projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.projects[idx] = { ...this.projects[idx], ...updates, updatedAt: new Date().toISOString() };
    }
    try {
      if (db) {
        const dbUpdates = {};
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.algorandAppId) dbUpdates.algorand_app_id = updates.algorandAppId;
        await updateDoc(doc(db, 'projects', id), dbUpdates);
      }
    } catch (e) {
      console.warn('Firestore project update failed:', e);
      throw new Error('Firestore project update failed: ' + e.message);
    }
    return this.projects[idx];
  }

  // ── MILESTONE OPERATIONS ──
  getProjectMilestones(projectId) {
    return this.milestones.filter(m => m.projectId === projectId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  getMilestone(id) {
    return this.milestones.find(m => m.id === id) || null;
  }

  async createMilestone(data) {
    const milestone = {
      id: data.id || 'MS-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      projectId: data.projectId,
      title: data.title,
      description: data.description || '',
      amount: data.amount,
      orderIndex: data.orderIndex || this.milestones.filter(m => m.projectId === data.projectId).length,
      workflowStatus: data.workflowStatus || 'PENDING',
      paymentStatus: data.paymentStatus || 'UNFUNDED',
      createdAt: new Date().toISOString()
    };
    this.milestones.push(milestone);

    // Sync to Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'milestones', milestone.id), {
          project_id: milestone.projectId,
          title: milestone.title,
          description: milestone.description,
          amount: milestone.amount,
          order_index: milestone.orderIndex,
          workflow_status: milestone.workflowStatus,
          payment_status: milestone.paymentStatus,
          created_at: milestone.createdAt
        });
      }
    } catch (e) {
      console.warn('Firestore milestone insert failed:', e);
      throw new Error('Firestore milestone sync failed: ' + e.message);
    }

    return milestone;
  }

  async updateMilestone(id, updates) {
    const idx = this.milestones.findIndex(m => m.id === id);
    if (idx !== -1) {
      this.milestones[idx] = { ...this.milestones[idx], ...updates };

      // Sync to Firestore
      try {
        if (db) {
          const dbUpdates = {};
          if (updates.workflowStatus) dbUpdates.workflow_status = updates.workflowStatus;
          if (updates.paymentStatus) dbUpdates.payment_status = updates.paymentStatus;
          if (updates.proofText !== undefined) dbUpdates.proof_text = updates.proofText;
          if (updates.proofFileName !== undefined) dbUpdates.proof_file_name = updates.proofFileName;
          if (updates.proofFileData !== undefined) dbUpdates.proof_file_data = updates.proofFileData;
          if (updates.aiFeedback !== undefined) dbUpdates.ai_feedback = updates.aiFeedback;
          if (updates.aiStatus !== undefined) dbUpdates.ai_status = updates.aiStatus;
          await updateDoc(doc(db, 'milestones', id), dbUpdates);
        }
      } catch (e) {
        console.warn('Firestore milestone update failed:', e);
        throw new Error('Firestore milestone update failed: ' + e.message);
      }
    }
    return this.milestones[idx];
  }

  // ── SUBMISSION OPERATIONS ──
  getProjectSubmissions(projectId) {
    return this.submissions.filter(s => s.projectId === projectId);
  }

  getMilestoneSubmissions(milestoneId) {
    return this.submissions.filter(s => s.milestoneId === milestoneId);
  }

  async createSubmission(data) {
    const submission = {
      id: data.id || 'SUB-' + Date.now(),
      milestoneId: data.milestoneId,
      projectId: data.projectId,
      proofType: data.proofType,
      proofUrl: data.proofUrl,
      notes: data.notes || '',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString()
    };
    this.submissions.push(submission);
    return submission;
  }

  // ── PAYMENT OPERATIONS ──
  getProjectPayments(projectId) {
    return this.payments.filter(p => p.projectId === projectId);
  }

  getUserPayments(address) {
    if (!address) return [];
    return this.payments.filter(p => 
      (p.sender && p.sender.toLowerCase() === address.toLowerCase()) || 
      (p.receiver && p.receiver.toLowerCase() === address.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async createPayment(data) {
    const payment = {
      id: data.id || 'PAY-' + Date.now(),
      milestoneId: data.milestoneId,
      projectId: data.projectId,
      amount: data.amount,
      txId: data.txId,
      status: data.status || 'COMPLETED',
      sender: data.sender || null,
      receiver: data.receiver || null,
      assetId: data.assetId || null,
      createdAt: new Date().toISOString()
    };
    this.payments.push(payment);

    // Sync to Firestore
    try {
      if (db) {
        await setDoc(doc(db, 'payments', payment.id), {
          milestone_id: payment.milestoneId,
          project_id: payment.projectId,
          amount: payment.amount,
          tx_id: payment.txId,
          status: payment.status,
          sender: payment.sender,
          receiver: payment.receiver,
          asset_id: payment.assetId,
          created_at: payment.createdAt
        });
      }
    } catch (e) {
      console.warn('Firestore payment insert failed:', e);
    }
    return payment;
  }

  // ── VERIFICATION RESULTS ──
  async createVerificationResult(data) {
    const result = {
      id: data.id || 'VR-' + Date.now(),
      submissionId: data.submissionId,
      score: data.score,
      passed: data.passed,
      details: data.details,
      createdAt: new Date().toISOString()
    };
    this.verificationResults.push(result);
    return result;
  }

  getSubmissionVerification(submissionId) {
    return this.verificationResults.find(v => v.submissionId === submissionId) || null;
  }

  // ── FREELANCER OPERATIONS ──
  async loadFreelancers() {
    try {
      if (db) {
        const snap = await getDocs(collection(db, 'freelancers')).catch(() => ({ docs: [] }));
        const loaded = [];
        snap.docs.forEach(d => {
          const data = d.data();
          loaded.push({
            id: d.id,
            name: data.name,
            domain: data.domain,
            experience: data.experience,
            rating: data.rating,
            completedProjects: data.completed_projects,
            hourlyRate: data.hourly_rate,
            hourlyRateDisplay: data.hourly_rate_display,
            location: data.location,
            availability: data.availability,
            bio: data.bio,
            email: data.email,
            joinedAt: data.joined_at
          });
        });
        if (loaded.length > 0) {
          this.freelancers = loaded;
        }
      }
    } catch (e) {
      console.warn('Failed to load freelancers from Firestore:', e);
    }
    return this.freelancers;
  }

  getFreelancers() { return [...this.freelancers]; }

  getFreelancer(id) {
    return this.freelancers.find(f => f.id === id) || null;
  }
}

export const NexrowDB = new NexrowDBClass();
