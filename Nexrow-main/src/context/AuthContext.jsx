import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  signInWithPopup,
  doc, 
  getDoc, 
  setDoc 
} from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch or create profile from Firestore
  async function fetchProfile(authUser) {
    if (!authUser) return null;
    try {
      const userRef = doc(db, 'profiles', authUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return userSnap.data();
      } else {
        const role = localStorage.getItem('role') || 'Client';
        const name = authUser.displayName || authUser.email;
        const newProf = {
          id: authUser.uid,
          email: authUser.email,
          full_name: name,
          role: role,
          createdAt: new Date().toISOString()
        };
        await setDoc(userRef, newProf);
        return newProf;
      }
    } catch (e) {
      console.warn('Firestore profile fetch failed, using local profile state:', e);
      // Local fallback for offline/demo mode if Firebase credentials are invalid
      const role = localStorage.getItem('role') || 'Client';
      return {
        id: authUser.uid,
        email: authUser.email,
        full_name: authUser.displayName || authUser.email,
        role: role
      };
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const prof = await fetchProfile(authUser);
        setUser({ id: authUser.uid, uid: authUser.uid, email: authUser.email });
        setProfile(prof);
        if (prof?.role) localStorage.setItem('role', prof.role);
        localStorage.setItem('user_email', authUser.email);
        localStorage.setItem('user_id', authUser.uid);
      } else {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('role');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_id');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const prof = await fetchProfile(res.user);
      setUser({ id: res.user.uid, uid: res.user.uid, email: res.user.email });
      setProfile(prof);
      if (prof?.role) localStorage.setItem('role', prof.role);
      return { user: res.user, profile: prof };
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email, password, name, role) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const newProf = {
        id: res.user.uid,
        email: res.user.email,
        full_name: name || res.user.email,
        role: role || 'Client',
        createdAt: new Date().toISOString()
      };
      
      try {
        await setDoc(doc(db, 'profiles', res.user.uid), newProf);
      } catch (e) {
        console.warn('Could not write profile to Firestore:', e);
      }

      setUser({ id: res.user.uid, uid: res.user.uid, email: res.user.email });
      setProfile(newProf);
      localStorage.setItem('role', role || 'Client');
      return { user: res.user, profile: newProf };
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    setUser(null);
    setProfile(null);
    localStorage.removeItem('role');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_id');
  };

  const signInWithGoogle = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const prof = await fetchProfile(res.user);
      setUser({ id: res.user.uid, uid: res.user.uid, email: res.user.email });
      setProfile(prof);
      return { user: res.user, profile: prof };
    } catch (error) {
      throw error;
    }
  };

  const role = profile?.role || localStorage.getItem('role') || 'Client';

  return (
    <AuthContext.Provider value={{
      user, profile, role, loading,
      signIn, signUp, signOut, signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
