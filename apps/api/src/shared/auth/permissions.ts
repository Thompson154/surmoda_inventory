// WHY: centralised role→action matrix prevents drift across modules.

export type Action =
  | 'sales:create'
  | 'sales:read'
  | 'sales:edit:post-charge'
  | 'sales:close-day'
  | 'inventory:read'
  | 'inventory:edit'
  | 'deliveries:create'
  | 'deliveries:read'
  | 'deliveries:edit'
  | 'deliveries:confirm-receive'
  | 'returns:request'
  | 'returns:review'
  | 'return-requests:create-with-replacement'
  | 'admin:everything';

export type Role = 'admin' | 'encargada' | 'vendedora';

export const PERMISSIONS: Record<Role, ReadonlyArray<Action>> = {
  // WHY: Wave 5 — vendedora pierde inventory:read; gana deliveries:read y picker de venta original.
  vendedora: [
    'sales:create',
    'sales:read',
    'sales:close-day',
    'returns:request',
    'return-requests:create-with-replacement',
    'deliveries:read',
  ],
  encargada: [
    'sales:read',
    'inventory:read',
    'deliveries:create',
    'deliveries:read',
    'deliveries:confirm-receive',
    'returns:request',
    'return-requests:create-with-replacement',
  ],
  // WHY: admin uses admin:everything wildcard — callers must check that action, not granular ones.
  admin: ['admin:everything'],
};

export function can(role: Role, action: Action): boolean {
  // WHY: admin wildcard passes every check — routes never need special-casing.
  if (role === 'admin') return true;
  return (PERMISSIONS[role] as ReadonlyArray<Action>).includes(action);
}
