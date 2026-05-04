import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// We must reset Zustand store between tests via module re-import
const STORAGE_KEY = 'surmoda:theme';

function mockMatchMedia(darkMatches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mq = {
    matches: darkMatches,
    addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach((cb) => cb({ matches: newMatches }));
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => mq),
  });
  return mq;
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    // Default: light system preference
    mockMatchMedia(false);
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to "system" when localStorage has no value', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    expect(result.current.theme).toBe('system');
  });

  it('initialises from localStorage when a saved theme exists', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    expect(result.current.theme).toBe('dark');
  });

  it('setTheme("dark") persists to localStorage with the correct key', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('setTheme("dark") adds "dark" class to document.documentElement', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme("light") removes "dark" class from document.documentElement', async () => {
    document.documentElement.classList.add('dark');
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('light');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setTheme("system") with prefers-color-scheme: dark adds "dark" class', async () => {
    mockMatchMedia(true);
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('system');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('setTheme("system") with prefers-color-scheme: light removes "dark" class', async () => {
    document.documentElement.classList.add('dark');
    mockMatchMedia(false);
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('system');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('resolvedTheme is "light" when theme is "light"', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('resolvedTheme is "dark" when theme is "dark"', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('resolvedTheme is never "system" — returns the resolved value when theme is "system"', async () => {
    mockMatchMedia(true); // system prefers dark
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());
    act(() => {
      result.current.setTheme('system');
    });
    expect(result.current.resolvedTheme).not.toBe('system');
    expect(['light', 'dark']).toContain(result.current.resolvedTheme);
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('toggleTheme cycles light → dark → system → light', async () => {
    const { useThemeStore } = await import('../useTheme');
    const { result } = renderHook(() => useThemeStore());

    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('system');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');
  });
});
