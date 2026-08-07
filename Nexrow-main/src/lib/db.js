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
    this._synced = false;
  }

  // ── SYNC FROM FIRESTORE ──
  async syncFromSupabase(user) { // Retaining method signature for backwards compatibility
    if (!user) return;
    try {
      if (db) {
        const q1 = query(collection(db, 'projects'), where('client_id', '==', user.id));
        const q2 = query(collection(db, 'projects'), where('freelancer_email', '==', user.email));
        
        const [snap1, snap2] = await Promise.all([
          getDocs(q1).catch(() => ({ docs: [] })),
          getDocs(q2).catch(() => ({ docs: [] }))
        ]);

        const projectDocs = [...(snap1.docs || []), ...(snap2.docs || [])];
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
          freelancer_id: project.freelancerId,
          total_budget: project.totalBudget,
          payment_type: project.paymentType,
          deadline: project.deadline,
          status: project.status,
          algorand_app_id: project.algorandAppId,
          created_at: project.createdAt
        });
      }
    } catch (e) { console.warn('Firestore project insert failed:', e); }

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
    } catch (e) { console.warn('Firestore project update failed:', e); }
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
    return milestone;
  }

  async updateMilestone(id, updates) {
    const idx = this.milestones.findIndex(m => m.id === id);
    if (idx !== -1) {
      this.milestones[idx] = { ...this.milestones[idx], ...updates };
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
}

export const NexrowDB = new NexrowDBClass();
