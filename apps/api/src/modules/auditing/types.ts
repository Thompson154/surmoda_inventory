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
  | 'ASSIGNMENT_REMOVED'
  | 'STORE_CREATED'
  | 'STORE_UPDATED'
  | 'STORE_DEACTIVATED'
  | 'STORE_REACTIVATED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DEACTIVATED'
  | 'PRODUCT_REACTIVATED'
  | 'VARIANT_CREATED'
  | 'VARIANT_UPDATED'
  | 'VARIANT_DEACTIVATED'
  | 'VARIANT_REACTIVATED'
  | 'INVENTORY_QUANTITY_ADJUSTED'
  | 'STORE_EDIT_PERMISSION_TOGGLED'
  | 'DELIVERY_CREATED'
  | 'DELIVERY_DRAFT_UPDATED'
  | 'DELIVERY_CONFIRMED'
  | 'DELIVERY_RECEIVED'
  | 'DELIVERY_RECEIVED_PARTIAL'
  | 'SALE_CREATED'
  | 'SALE_RETURN_CREATE'
  | 'DAILY_REPORT_CLOSED'
  | 'RETURN_REQUEST_CREATE'
  | 'RETURN_REQUEST_APPROVE'
  | 'RETURN_REQUEST_REJECT'
  // WHY: admin retroactive edits to closed daily reports require documented reason.
  | 'DAILY_CLOSURE_RETROACTIVE_EDIT'
  | 'DELIVERY_EDIT_REQUEST_CREATE'
  | 'DELIVERY_EDIT_REQUEST_APPROVE'
  | 'DELIVERY_EDIT_REQUEST_REJECT';

export type AuditEntity =
  | 'User'
  | 'UserStore'
  | 'RefreshToken'
  | 'Store'
  | 'Product'
  | 'Variant'
  | 'Stock'
  | 'StoreEditPermission'
  | 'Delivery'
  | 'Sale'
  | 'StockMovement'
  | 'DailyReport'
  | 'ReturnRequest'
  | 'DeliveryEditRequest';

export interface AuditWriteInput {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}
