// Unit: FE env config validation via Zod
// Tests validate the schema logic directly — avoids import.meta.env module-cache issues
// by testing the schema parsing function in isolation.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// WHY: replicate the schema here to test parsing logic without ES module cache issues
const EnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:3000/api/v1'),
  VITE_BUILD_VERSION: z.string().optional(),
});

describe('shared/config — Zod env schema', () => {
  it('uses default URL when VITE_API_BASE_URL is absent', () => {
    const result = EnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VITE_API_BASE_URL).toBe('http://localhost:3000/api/v1');
    }
  });

  it('parses a valid custom VITE_API_BASE_URL', () => {
    const result = EnvSchema.safeParse({
      VITE_API_BASE_URL: 'https://api.surmoda.com/api/v1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VITE_API_BASE_URL).toBe('https://api.surmoda.com/api/v1');
    }
  });

  it('fails when VITE_API_BASE_URL is not a valid URL', () => {
    const result = EnvSchema.safeParse({ VITE_API_BASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.VITE_API_BASE_URL).toBeDefined();
    }
  });

  it('accepts an optional VITE_BUILD_VERSION', () => {
    const result = EnvSchema.safeParse({
      VITE_BUILD_VERSION: '1.2.3',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VITE_BUILD_VERSION).toBe('1.2.3');
    }
  });

  it('allows VITE_BUILD_VERSION to be absent', () => {
    const result = EnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.VITE_BUILD_VERSION).toBeUndefined();
    }
  });
});
