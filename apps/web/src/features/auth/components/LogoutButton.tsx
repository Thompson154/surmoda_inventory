// T094 — LogoutButton component
// WHY: gives any authenticated user a way to end their session from the current device.
// Behaviour:
//   1. Calls authService.logout to revoke the server-side refresh token.
//   2. Clears the Zustand auth store regardless of whether the API call succeeded
//      (network errors should not trap the user in a broken auth state).
//   3. Redirects to /login.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { Button } from '@/shared/ui';

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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      leftIcon={<LogOut className="h-4 w-4" />}
      onClick={() => void handleLogout()}
      disabled={loading}
      className={className}
    >
      {loading ? 'Saliendo...' : 'Cerrar sesión'}
    </Button>
  );
}
