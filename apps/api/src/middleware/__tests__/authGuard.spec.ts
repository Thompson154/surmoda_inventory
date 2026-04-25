import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authGuard } from '../authGuard';
import { TokenExpiredError, TokenInvalidError } from '../../shared/errors/authErrors';
import { signAccessToken } from '../../infrastructure/jwt';
import { loadConfig } from '../../infrastructure/config';

function makeReq(authorization?: string): Request {
  return { headers: { ...(authorization ? { authorization } : {}) } } as unknown as Request;
}
function makeRes(): Response {
  return {} as Response;
}

describe('authGuard', () => {
  it('rejects with TokenInvalidError when no Authorization header', () => {
    const next = jest.fn();
    authGuard(makeReq(), makeRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(TokenInvalidError);
  });

  it('rejects with TokenInvalidError on malformed Bearer token', () => {
    const next = jest.fn();
    authGuard(makeReq('Bearer not.a.token'), makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(TokenInvalidError);
  });

  it('rejects with TokenExpiredError on expired token', () => {
    const config = loadConfig();
    const token = jwt.sign({ sub: 'u1', isAdmin: false }, config.JWT_SECRET, { expiresIn: -10 });
    const next = jest.fn();
    authGuard(makeReq(`Bearer ${token}`), makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(TokenExpiredError);
  });

  it('populates req.auth and calls next() on a valid token', () => {
    const token = signAccessToken({ sub: 'u-42', isAdmin: true });
    const req = makeReq(`Bearer ${token}`);
    const next = jest.fn();
    authGuard(req, makeRes(), next as unknown as NextFunction);
    expect(req.auth).toEqual({ userId: 'u-42', isAdmin: true });
    expect(next).toHaveBeenCalledWith();
  });
});
