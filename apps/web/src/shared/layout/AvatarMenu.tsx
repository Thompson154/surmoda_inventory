import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Boxes, ShieldCheck, User as UserIcon } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { cn } from '@/shared/ui/cn';

function initialsFromName(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function AvatarMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
    } catch {
      // Clear local state regardless of API outcome.
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  const goSedes = () => {
    setOpen(false);
    navigate('/sedes');
  };

  const goAdminPanel = () => {
    setOpen(false);
    navigate('/admin');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'h-9 w-9 rounded-full bg-brand-primary text-white text-sm font-semibold',
          'flex items-center justify-center shrink-0',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
          'hover:opacity-90 transition-opacity',
        )}
        aria-label="Abrir menú de usuario"
      >
        {initialsFromName(user?.fullName)}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 mt-2 w-56 rounded-xl border border-surface-border bg-white shadow-xl z-50',
            'animate-fade-in',
          )}
        >
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-sm font-semibold text-slate-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={goSedes}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-sunken transition-colors"
          >
            <Boxes className="h-4 w-4 text-slate-400" />
            Volver a sucursales
          </button>

          {user?.isAdmin && (
            <button
              type="button"
              role="menuitem"
              onClick={goAdminPanel}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-surface-sunken transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-slate-400" />
              Panel admin
            </button>
          )}

          <div className="border-t border-surface-border">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-status-danger hover:bg-status-danger-soft transition-colors disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
            </button>
          </div>

          <span className="sr-only">
            <UserIcon className="h-4 w-4" />
          </span>
        </div>
      )}
    </div>
  );
}
