// Unit tests for the permissions matrix — full role × action coverage.
// RED phase: written before permissions.ts exists.

import { PERMISSIONS, can } from '../permissions';

describe('PERMISSIONS matrix', () => {
  describe('vendedora', () => {
    it('can sales:create', () => {
      expect(can('vendedora', 'sales:create')).toBe(true);
    });
    it('can sales:read', () => {
      expect(can('vendedora', 'sales:read')).toBe(true);
    });
    it('can sales:close-day', () => {
      expect(can('vendedora', 'sales:close-day')).toBe(true);
    });
    it('can returns:request', () => {
      expect(can('vendedora', 'returns:request')).toBe(true);
    });
    // WHY: Wave 5 — vendedora can submit return requests with original-sale picker.
    it('can return-requests:create-with-replacement', () => {
      expect(can('vendedora', 'return-requests:create-with-replacement')).toBe(true);
    });
    // WHY: Wave 5 — vendedora can see deliveries for her store (read-only).
    it('can deliveries:read', () => {
      expect(can('vendedora', 'deliveries:read')).toBe(true);
    });
    it('cannot sales:edit:post-charge', () => {
      expect(can('vendedora', 'sales:edit:post-charge')).toBe(false);
    });
    // WHY: Wave 5 — vendedora no longer sees inventory at all.
    it('cannot inventory:read', () => {
      expect(can('vendedora', 'inventory:read')).toBe(false);
    });
    it('cannot inventory:edit', () => {
      expect(can('vendedora', 'inventory:edit')).toBe(false);
    });
    it('cannot deliveries:create', () => {
      expect(can('vendedora', 'deliveries:create')).toBe(false);
    });
    it('cannot deliveries:edit', () => {
      expect(can('vendedora', 'deliveries:edit')).toBe(false);
    });
    // WHY: Wave 5 — vendedora cannot confirm delivery reception (encargada/admin only).
    it('cannot deliveries:confirm-receive', () => {
      expect(can('vendedora', 'deliveries:confirm-receive')).toBe(false);
    });
    it('cannot returns:review', () => {
      expect(can('vendedora', 'returns:review')).toBe(false);
    });
    it('cannot admin:everything', () => {
      expect(can('vendedora', 'admin:everything')).toBe(false);
    });
  });

  describe('encargada', () => {
    it('can sales:read', () => {
      expect(can('encargada', 'sales:read')).toBe(true);
    });
    it('can inventory:read', () => {
      expect(can('encargada', 'inventory:read')).toBe(true);
    });
    it('can deliveries:create', () => {
      expect(can('encargada', 'deliveries:create')).toBe(true);
    });
    it('can deliveries:read', () => {
      expect(can('encargada', 'deliveries:read')).toBe(true);
    });
    // WHY: Wave 5 — encargada confirms delivery reception at her store.
    it('can deliveries:confirm-receive', () => {
      expect(can('encargada', 'deliveries:confirm-receive')).toBe(true);
    });
    it('can returns:request', () => {
      expect(can('encargada', 'returns:request')).toBe(true);
    });
    it('can return-requests:create-with-replacement', () => {
      expect(can('encargada', 'return-requests:create-with-replacement')).toBe(true);
    });
    it('cannot sales:create', () => {
      expect(can('encargada', 'sales:create')).toBe(false);
    });
    it('cannot sales:edit:post-charge', () => {
      expect(can('encargada', 'sales:edit:post-charge')).toBe(false);
    });
    it('cannot sales:close-day', () => {
      expect(can('encargada', 'sales:close-day')).toBe(false);
    });
    it('cannot inventory:edit', () => {
      expect(can('encargada', 'inventory:edit')).toBe(false);
    });
    it('cannot deliveries:edit', () => {
      expect(can('encargada', 'deliveries:edit')).toBe(false);
    });
    it('cannot returns:review', () => {
      expect(can('encargada', 'returns:review')).toBe(false);
    });
    it('cannot admin:everything', () => {
      expect(can('encargada', 'admin:everything')).toBe(false);
    });
  });

  describe('admin', () => {
    it('can admin:everything', () => {
      expect(can('admin', 'admin:everything')).toBe(true);
    });
    // WHY: admin wildcard passes any action so routes never need special-casing.
    it('can sales:create (wildcard)', () => {
      expect(can('admin', 'sales:create')).toBe(true);
    });
    it('can inventory:edit (wildcard)', () => {
      expect(can('admin', 'inventory:edit')).toBe(true);
    });
    it('can returns:review (wildcard)', () => {
      expect(can('admin', 'returns:review')).toBe(true);
    });
    it('can sales:close-day (wildcard)', () => {
      expect(can('admin', 'sales:close-day')).toBe(true);
    });
    it('can deliveries:edit (wildcard)', () => {
      expect(can('admin', 'deliveries:edit')).toBe(true);
    });
    it('can deliveries:read (wildcard)', () => {
      expect(can('admin', 'deliveries:read')).toBe(true);
    });
    it('can deliveries:confirm-receive (wildcard)', () => {
      expect(can('admin', 'deliveries:confirm-receive')).toBe(true);
    });
    it('can return-requests:create-with-replacement (wildcard)', () => {
      expect(can('admin', 'return-requests:create-with-replacement')).toBe(true);
    });
  });

  describe('PERMISSIONS export shape', () => {
    it('has all three roles', () => {
      expect(PERMISSIONS).toHaveProperty('vendedora');
      expect(PERMISSIONS).toHaveProperty('encargada');
      expect(PERMISSIONS).toHaveProperty('admin');
    });

    it('vendedora permissions are readonly array', () => {
      expect(Array.isArray(PERMISSIONS.vendedora)).toBe(true);
    });
  });
});
