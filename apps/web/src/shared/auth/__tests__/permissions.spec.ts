import { describe, expect, it } from 'vitest';
import { can, type Role, type Action } from '../permissions';

describe('permissions matrix', () => {
  describe('vendedora', () => {
    const role: Role = 'vendedora';

    it('can create sales', () => expect(can(role, 'sales:create')).toBe(true));
    it('can read sales', () => expect(can(role, 'sales:read')).toBe(true));
    it('can close day', () => expect(can(role, 'sales:close-day')).toBe(true));
    it('can request returns', () => expect(can(role, 'returns:request')).toBe(true));
    it('can read deliveries', () => expect(can(role, 'deliveries:read')).toBe(true));
    it('can see closures history', () => expect(can(role, 'sales:closures-history')).toBe(true));

    // Wave 5: vendedora LOSES inventory:read
    it('cannot read inventory', () => expect(can(role, 'inventory:read')).toBe(false));
    it('cannot edit inventory', () => expect(can(role, 'inventory:edit')).toBe(false));
    it('cannot create deliveries', () => expect(can(role, 'deliveries:create')).toBe(false));
    it('cannot confirm delivery receive', () =>
      expect(can(role, 'deliveries:confirm-receive')).toBe(false));
    it('cannot review returns', () => expect(can(role, 'returns:review')).toBe(false));
    it('cannot manage users', () => expect(can(role, 'users:manage')).toBe(false));
    it('cannot generate reports', () => expect(can(role, 'reports:generate')).toBe(false));
    it('cannot see full sales view', () => expect(can(role, 'sales:full-view')).toBe(false));
    it('cannot do admin:everything', () => expect(can(role, 'admin:everything')).toBe(false));
  });

  describe('encargada', () => {
    const role: Role = 'encargada';

    it('can read sales', () => expect(can(role, 'sales:read')).toBe(true));
    it('can read inventory', () => expect(can(role, 'inventory:read')).toBe(true));
    it('can create deliveries', () => expect(can(role, 'deliveries:create')).toBe(true));
    it('can read deliveries', () => expect(can(role, 'deliveries:read')).toBe(true));
    it('can confirm delivery receive', () =>
      expect(can(role, 'deliveries:confirm-receive')).toBe(true));
    it('can request returns', () => expect(can(role, 'returns:request')).toBe(true));
    it('can generate reports', () => expect(can(role, 'reports:generate')).toBe(true));
    it('can see full sales view', () => expect(can(role, 'sales:full-view')).toBe(true));
    it('can see closures history', () => expect(can(role, 'sales:closures-history')).toBe(true));

    it('cannot create sales', () => expect(can(role, 'sales:create')).toBe(false));
    it('cannot close day', () => expect(can(role, 'sales:close-day')).toBe(false));
    it('cannot edit inventory', () => expect(can(role, 'inventory:edit')).toBe(false));
    it('cannot manage users', () => expect(can(role, 'users:manage')).toBe(false));
    it('cannot review returns', () => expect(can(role, 'returns:review')).toBe(false));
    it('cannot do admin:everything', () => expect(can(role, 'admin:everything')).toBe(false));
  });

  describe('admin', () => {
    const role: Role = 'admin';
    const actions: Action[] = [
      'sales:create',
      'sales:read',
      'sales:close-day',
      'sales:full-view',
      'sales:closures-history',
      'inventory:read',
      'inventory:edit',
      'deliveries:create',
      'deliveries:edit',
      'deliveries:read',
      'deliveries:confirm-receive',
      'products:read',
      'products:edit',
      'stores:read',
      'stores:edit',
      'users:manage',
      'returns:request',
      'returns:review',
      'reports:generate',
      'admin:everything',
    ];

    actions.forEach((action) => {
      it(`can do ${action} (wildcard)`, () => expect(can(role, action)).toBe(true));
    });
  });
});
