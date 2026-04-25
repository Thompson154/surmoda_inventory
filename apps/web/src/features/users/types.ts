// WHY: types live in @surmoda/contracts — single source of truth.
// Re-export everything so existing consumers keep their import paths unchanged.
export type {
  Role,
  UserAssignment,
  User,
  UserListItem,
  PaginatedUsers,
  CreateUserPayload,
  UpdateUserPayload,
  ListUsersFilters,
  Assignment,
  AssignmentsListResponse,
  CreateAssignmentPayload,
  UpdateAssignmentPayload,
} from '@surmoda/contracts';
