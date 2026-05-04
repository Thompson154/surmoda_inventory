import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Boxes, ShieldCheck, User as UserIcon, Sun, Moon, Monitor } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/useAuthStore';
import { useTheme } from '@/shared/theme/useTheme';
import { cn } from '@/shared/ui/cn';

function initialsFromName(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const THEME_LABELS: Record<
  string,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  light: { label: 'Tema: Claro', Icon: Sun },
  dark: { label: 'Tema: Oscuro', Icon: Moon },
  system: { label: 'Tema: Sistema', Icon: Monitor },
};

export function AvatarMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const themeEntry = THEME_LABELS[theme] ?? THEME_LABELS.system!;
  const ThemeIcon = themeEntry.Icon;

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
            'absolute right-0 mt-2 w-56 rounded-xl border border-surface-border bg-surface-raised shadow-xl z-50',
            'animate-fade-in',
          )}
        >
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-sm font-semibold text-text-primary truncate">{user?.fullName}</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={goSedes}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-sunken transition-colors"
          >
            <Boxes className="h-4 w-4 text-text-subtle" />
            Volver a sucursales
          </button>

          {user?.isAdmin && (
            <button
              type="button"
              role="menuitem"
              onClick={goAdminPanel}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-sunken transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-text-subtle" />
              Panel admin
            </button>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={toggleTheme}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-sunken transition-colors"
          >
            <ThemeIcon className="h-4 w-4 text-text-subtle transition-transform duration-200" />
            {themeEntry.label}
          </button>

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
