export type Role = 'admin' | 'encargada' | 'vendedora';

export type Action =
  | 'sales:create'
  | 'sales:read'
  | 'sales:close-day'
  | 'sales:full-view'
  | 'sales:closures-history'
  | 'inventory:read'
  | 'inventory:edit'
  | 'deliveries:create'
  | 'deliveries:edit'
  | 'deliveries:read'
  | 'deliveries:confirm-receive'
  | 'products:read'
  | 'products:edit'
  | 'stores:read'
  | 'stores:edit'
  | 'users:manage'
  | 'returns:request'
  | 'returns:review'
  | 'reports:generate'
  | 'admin:everything';

const PERMISSIONS: Record<Exclude<Role, 'admin'>, ReadonlyArray<Action>> = {
  // Wave 5: vendedora loses inventory:read; gains deliveries:read + sales:closures-history
  vendedora: [
    'sales:create',
    'sales:read',
    'sales:close-day',
    'sales:closures-history',
    'returns:request',
    'deliveries:read',
  ],
  encargada: [
    'sales:read',
    'sales:full-view',
    'sales:closures-history',
    'inventory:read',
    'deliveries:create',
    'deliveries:read',
    'deliveries:confirm-receive',
    'returns:request',
    'reports:generate',
  ],
};

// WHY: admin wildcard avoids maintaining a growing list of actions
export function can(role: Role, action: Action): boolean {
  if (role === 'admin') return true;
  return (PERMISSIONS[role] as ReadonlyArray<Action>).includes(action);
}
