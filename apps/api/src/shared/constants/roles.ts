export const ROLE = {
  encargada: 'encargada',
  vendedora: 'vendedora',
} as const;

export type RoleName = keyof typeof ROLE;

export const ADMIN_FLAG = 'admin' as const;

export type RoleScope = RoleName | typeof ADMIN_FLAG;
