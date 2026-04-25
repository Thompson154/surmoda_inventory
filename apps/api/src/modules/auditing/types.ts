export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_LOGOUT'
  | 'AUTH_REFRESH_TOKEN_REPLAY'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_PASSWORD_RESET_BY_ADMIN'
  | 'ASSIGNMENT_CREATED'
  | 'ASSIGNMENT_ROLE_CHANGED'
  | 'ASSIGNMENT_REMOVED';

export type AuditEntity = 'User' | 'UserStore' | 'RefreshToken';

export interface AuditWriteInput {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}
