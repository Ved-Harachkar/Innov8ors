// Initialize Supabase Client globally if the CDN script is loaded
const supabaseUrl = 'https://qhcxwwobfqsecwqsvwid.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoY3h3d29iZnFzZWN3cXN2d2lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODc0NzQsImV4cCI6MjA5NDc2MzQ3NH0.ZIcAU6PjSwEHeGZtD8B8NKJEd3YifgZa7S7hR9zbkMM';

// Global Supabase client initialization
let clientCreator = null;
if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
  clientCreator = window.supabase.createClient;
} else if (typeof window.supabaseJS !== 'undefined' && window.supabaseJS.createClient) {
  clientCreator = window.supabaseJS.createClient;
} else if (typeof createClient !== 'undefined') {
  clientCreator = createClient;
}

window.supabase = null;
if (clientCreator) {
  window.supabase = clientCreator(supabaseUrl, supabaseKey);
}

const isRoot = !window.location.pathname.includes('/pages/');

// ── REQUIRE AUTH GUARD ──
window.requireAuth = async function(callback) {
  let activeUser = null;

  if (window.supabase) {
    try {
      const { data: { session } } = await window.supabase.auth.getSession();
      if (session?.user) {
        activeUser = session.user;
      }
    } catch (e) {
      console.warn("Supabase auth check exception:", e);
    }
  }
  
  // Local / Demo session fallback
  if (!activeUser) {
    const storedRole = localStorage.getItem('role') || 'Client';
    activeUser = {
      id: localStorage.getItem('user_id') || 'demo-client-id',
      email: localStorage.getItem('user_email') || 'client@nexrow.app',
      role: storedRole
    };
  }

  callback(activeUser);
};

// ── SET NAV USER DISPLAY ──
window.setNavUser = function(user) {
  const el = document.getElementById('navUser');
  if (el) {
    const email = user?.email || 'client@nexrow.app';
    el.textContent = email.length > 24 ? email.slice(0, 22) + '…' : email;
  }
};

// ── SETUP LOGOUT HANDLER ──
window.setupLogout = function() {
  const btn = document.getElementById('logoutBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      localStorage.removeItem('role');
      if (window.supabase) {
        try { await window.supabase.auth.signOut(); } catch(e){}
      }
      window.location.href = isRoot ? 'index.html' : '../index.html';
    });
  }
};

// ── GOOGLE SIGN IN ──
window.signInWithGoogle = async function() {
  if (!window.supabase) throw new Error("Supabase is not initialized.");
  const redirectUrl = window.location.origin + (isRoot ? '' : '/pages') + (isRoot ? '/index.html' : '/../index.html');
  const { data, error } = await window.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  });
  if (error) throw error;
  return data;
};

// ── COMMON UTILITIES ──
window.formatINR = function(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

window.formatDate = function(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

window.genDealCode = function() {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return 'SUPX-' + code;
};

window.genDealId = function() {
  return 'SX-' + Date.now().toString(36).toUpperCase()
       + '-' + Math.random().toString(36).slice(2,5).toUpperCase();
};

window.generateOTP = function() {
  return String(Math.floor(100000 + Math.random() * 900000));
};

window.redirectByRole = async function(userId) {
  const isRoot = !window.location.pathname.includes('/pages/');
  const currentRole = (localStorage.getItem('role') || 'Client').trim();

  if (currentRole.toLowerCase() === 'client') {
    window.location.href = isRoot ? 'pages/create-contract.html' : 'create-contract.html';
  } else if (currentRole.toLowerCase() === 'freelancer') {
    window.location.href = isRoot ? 'pages/upload-proof.html' : 'upload-proof.html';
  } else if (currentRole.toLowerCase() === 'admin') {
    window.location.href = isRoot ? 'pages/status.html' : 'status.html';
  } else {
    window.location.href = isRoot ? 'pages/create-contract.html' : 'create-contract.html';
  }
};
