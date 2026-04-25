import { AppError } from './AppError';
import { ERROR_CODES } from '../constants/errorCodes';

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_LOGIN_INVALID_CREDENTIALS, 'Invalid email or password');
  }
}

export class UserInactiveError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_LOGIN_USER_INACTIVE, 'Account is inactive');
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_TOKEN_EXPIRED, 'Token expired');
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_TOKEN_INVALID, 'Token invalid');
  }
}

export class RefreshTokenNotFoundError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_REFRESH_TOKEN_NOT_FOUND, 'Refresh token not found');
  }
}

export class RefreshTokenRevokedError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED, 'Refresh token revoked');
  }
}

export class RefreshTokenExpiredError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED, 'Refresh token expired');
  }
}

export class TokenReplayError extends AppError {
  constructor() {
    super(401, ERROR_CODES.AUTH_REFRESH_TOKEN_REPLAY, 'Refresh token replay detected');
  }
}

export class ForbiddenStoreError extends AppError {
  constructor() {
    super(403, ERROR_CODES.AUTH_FORBIDDEN_STORE, 'Access to this store is not authorised');
  }
}

export class ForbiddenRoleError extends AppError {
  constructor() {
    super(403, ERROR_CODES.AUTH_FORBIDDEN_ROLE, 'Role does not permit this operation');
  }
}
