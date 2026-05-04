import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'surmoda:theme';
const CYCLE: Theme[] = ['light', 'dark', 'system'];

function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // localStorage unavailable
  }
  return 'system';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyThemeClass(resolved: 'light' | 'dark'): void {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** Call once at app boot to wire the system media-query listener */
  _initSystemListener: () => () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = readStoredTheme();
  const initialResolved = resolveTheme(initial);
  applyThemeClass(initialResolved);

  return {
    theme: initial,
    resolvedTheme: initialResolved,

    setTheme(theme: Theme) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // ignore
      }
      const resolved = resolveTheme(theme);
      applyThemeClass(resolved);
      set({ theme, resolvedTheme: resolved });
    },

    toggleTheme() {
      const { theme } = get();
      const idx = CYCLE.indexOf(theme);
      const next = CYCLE[(idx + 1) % CYCLE.length] ?? 'light';
      get().setTheme(next);
    },

    _initSystemListener() {
      let mq: MediaQueryList | null = null;
      try {
        mq = window.matchMedia('(prefers-color-scheme: dark)');
      } catch {
        return () => {};
      }

      const handler = () => {
        const { theme } = get();
        if (theme === 'system') {
          const resolved = resolveTheme('system');
          applyThemeClass(resolved);
          set({ resolvedTheme: resolved });
        }
      };

      mq.addEventListener('change', handler);
      return () => mq!.removeEventListener('change', handler);
    },
  };
});

/** Convenience hook that returns the public API */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  return { theme, resolvedTheme, setTheme, toggleTheme };
}
