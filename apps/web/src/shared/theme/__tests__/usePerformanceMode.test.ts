import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const STORAGE_KEY = 'surmoda:reduce-motion';

describe('usePerformanceMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('reduce-motion');
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('reduce-motion');
  });

  it('defaults to false (reduceMotion off) when localStorage is empty', async () => {
    const { usePerformanceModeStore } = await import('../usePerformanceMode');
    const { result } = renderHook(() => usePerformanceModeStore());
    expect(result.current.reduceMotion).toBe(false);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });

  it('initializes from localStorage when true', async () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { usePerformanceModeStore } = await import('../usePerformanceMode');
    const { result } = renderHook(() => usePerformanceModeStore());
    expect(result.current.reduceMotion).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('toggles performance mode and updates DOM class and localStorage', async () => {
    const { usePerformanceModeStore } = await import('../usePerformanceMode');
    const { result } = renderHook(() => usePerformanceModeStore());

    expect(result.current.reduceMotion).toBe(false);

    act(() => {
      result.current.togglePerformanceMode();
    });

    expect(result.current.reduceMotion).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');

    act(() => {
      result.current.togglePerformanceMode();
    });

    expect(result.current.reduceMotion).toBe(false);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });
});
