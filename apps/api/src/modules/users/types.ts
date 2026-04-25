import type {
  User as UserContract,
  UserAssignment as UserAssignmentContract,
  UserListItem as UserListItemContract,
  PaginatedUsers as PaginatedUsersContract,
  CreateUserPayload,
  UpdateUserPayload,
  ResetPasswordPayload,
} from '@surmoda/contracts';

export type UserAssignmentDTO = UserAssignmentContract;
export type UserDTO = UserContract;
export type UserListItem = UserListItemContract;
export type PaginatedUsers = PaginatedUsersContract;
export type CreateUserDTO = CreateUserPayload;
export type UpdateUserDTO = UpdateUserPayload;
export type ResetPasswordDTO = ResetPasswordPayload;

// WHY: ListUsersQuery is BE-specific — page is REQUIRED here (defaulted by the validator),
// whereas ListUsersFilters in contracts has page?: optional (FE/shared usage).
export interface ListUsersQuery {
  q?: string;
  isActive?: boolean;
  isAdmin?: boolean;
  page: number;
  pageSize: number;
}
