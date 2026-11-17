import { create } from 'zustand';

const STORAGE_KEY = 'surmoda:reduce-motion';

function readStoredPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // localStorage unavailable
  }
  // Default is OFF (all animations & effects active)
  return false;
}

function applyReduceMotionClass(enabled: boolean): void {
  const root = document.documentElement;
  if (enabled) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
}

interface PerformanceModeState {
  reduceMotion: boolean;
  togglePerformanceMode: () => void;
  setPerformanceMode: (enabled: boolean) => void;
}

export const usePerformanceModeStore = create<PerformanceModeState>((set, get) => {
  const initial = readStoredPreference();
  applyReduceMotionClass(initial);

  return {
    reduceMotion: initial,

    setPerformanceMode(enabled: boolean) {
      try {
        localStorage.setItem(STORAGE_KEY, String(enabled));
      } catch {
        // ignore
      }
      applyReduceMotionClass(enabled);
      set({ reduceMotion: enabled });
    },

    togglePerformanceMode() {
      const next = !get().reduceMotion;
      get().setPerformanceMode(next);
    },
  };
});

export function usePerformanceMode() {
  const reduceMotion = usePerformanceModeStore((s) => s.reduceMotion);
  const togglePerformanceMode = usePerformanceModeStore((s) => s.togglePerformanceMode);
  const setPerformanceMode = usePerformanceModeStore((s) => s.setPerformanceMode);
  return { reduceMotion, togglePerformanceMode, setPerformanceMode };
}
