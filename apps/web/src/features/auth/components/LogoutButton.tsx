// T094 — LogoutButton component
// WHY: gives any authenticated user a way to end their session from the current device.
// Behaviour:
//   1. Calls authService.logout to revoke the server-side refresh token.
//   2. Clears the Zustand auth store regardless of whether the API call succeeded
//      (network errors should not trap the user in a broken auth state).
//   3. Redirects to /login.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch {
      // If the API call fails the session is already stale on the client side.
      // Clear local state and redirect regardless.
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loading}
      className={
        className ??
        'rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-500 hover:text-slate-900 disabled:opacity-50'
      }
    >
      {loading ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
