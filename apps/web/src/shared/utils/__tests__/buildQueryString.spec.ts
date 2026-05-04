import { describe, it, expect } from 'vitest';
import { buildQueryString } from '../buildQueryString';

describe('buildQueryString', () => {
  it('returns empty string when filters object is empty', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('returns empty string when all values are null', () => {
    expect(buildQueryString({ q: null, page: null })).toBe('');
  });

  it('returns empty string when all values are undefined', () => {
    expect(buildQueryString({ q: undefined, page: undefined })).toBe('');
  });

  it('skips empty string values', () => {
    expect(buildQueryString({ q: '' })).toBe('');
  });

  it('skips whitespace-only string values', () => {
    expect(buildQueryString({ q: '   ' })).toBe('');
  });

  it('trims string values before including them', () => {
    const result = buildQueryString({ q: '  jean  ' });
    const url = new URLSearchParams(result.slice(1));
    expect(url.get('q')).toBe('jean');
  });

  it('serialises booleans correctly', () => {
    const result = buildQueryString({ isActive: true, includeInactive: false });
    const url = new URLSearchParams(result.slice(1));
    expect(url.get('isActive')).toBe('true');
    expect(url.get('includeInactive')).toBe('false');
  });

  it('serialises numbers correctly', () => {
    const result = buildQueryString({ page: 2, pageSize: 20 });
    const url = new URLSearchParams(result.slice(1));
    expect(url.get('page')).toBe('2');
    expect(url.get('pageSize')).toBe('20');
  });

  it('returns a string starting with ? when there are valid params', () => {
    expect(buildQueryString({ q: 'jeans' })).toMatch(/^\?/);
  });

  it('mixes string, number, boolean and skips null/undefined correctly', () => {
    const result = buildQueryString({
      q: 'jean',
      page: 1,
      isActive: true,
      color: null,
      size: undefined,
      stockStatus: '',
    });
    const url = new URLSearchParams(result.slice(1));
    expect(url.get('q')).toBe('jean');
    expect(url.get('page')).toBe('1');
    expect(url.get('isActive')).toBe('true');
    expect(url.has('color')).toBe(false);
    expect(url.has('size')).toBe(false);
    expect(url.has('stockStatus')).toBe(false);
  });
});
