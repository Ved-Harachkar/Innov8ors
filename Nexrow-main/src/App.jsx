import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateContract from './pages/CreateContract';
import LiveDashboard from './pages/LiveDashboard';
import UploadProof from './pages/UploadProof';
import Status from './pages/Status';
import Payment from './pages/Payment';
import ClientJoin from './pages/ClientJoin';
import OtpVerify from './pages/OtpVerify';
import RoleSelect from './pages/RoleSelect';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/create-contract" element={
            <ProtectedRoute requiredRole="Client">
              <CreateContract />
            </ProtectedRoute>
          } />

          <Route path="/live-dashboard" element={
            <ProtectedRoute>
              <LiveDashboard />
            </ProtectedRoute>
          } />

          <Route path="/upload-proof" element={
            <ProtectedRoute>
              <UploadProof />
            </ProtectedRoute>
          } />

          <Route path="/status/:id" element={
            <ProtectedRoute>
              <Status />
            </ProtectedRoute>
          } />

          <Route path="/payment" element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          } />

          <Route path="/client-join" element={
            <ProtectedRoute>
              <ClientJoin />
            </ProtectedRoute>
          } />

          <Route path="/otp-verify" element={
            <ProtectedRoute>
              <OtpVerify />
            </ProtectedRoute>
          } />

          <Route path="/role-select" element={
            <ProtectedRoute>
              <RoleSelect />
            </ProtectedRoute>
          } />

          {/* Fallback & Redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
