import type { Request, Response, NextFunction } from 'express';
import { roleGuard } from '../roleGuard';
import { ForbiddenRoleError, ForbiddenStoreError, TokenInvalidError } from '../../shared/errors/authErrors';

jest.mock('../../infrastructure/database', () => {
  const findFirst = jest.fn();
  return {
    getPrisma: () => ({ userStore: { findFirst } }),
    __findFirst: findFirst,
  };
});

const dbModule = jest.requireMock('../../infrastructure/database') as { __findFirst: jest.Mock };

function makeReq(opts: Partial<Request> = {}): Request {
  return {
    auth: undefined,
    params: {},
    body: {},
    ...opts,
  } as Request;
}
function makeRes(): Response {
  return {} as Response;
}

beforeEach(() => {
  dbModule.__findFirst.mockReset();
});

describe('roleGuard', () => {
  it('rejects when req.auth is missing', async () => {
    const next = jest.fn();
    await roleGuard(['admin'])(makeReq(), makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(TokenInvalidError);
  });

  it('admin-flag user always passes', async () => {
    const next = jest.fn();
    const req = makeReq({ auth: { userId: 'admin-1', isAdmin: true } });
    await roleGuard(['encargada'])(req, makeRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it('non-admin without storeId in params is rejected with ForbiddenStoreError', async () => {
    const next = jest.fn();
    const req = makeReq({ auth: { userId: 'u1', isAdmin: false }, params: {} as Request['params'] });
    await roleGuard(['vendedora'])(req, makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenStoreError);
  });

  it('non-admin without an assignment in target store is rejected', async () => {
    dbModule.__findFirst.mockResolvedValue(null);
    const next = jest.fn();
    const req = makeReq({
      auth: { userId: 'u1', isAdmin: false },
      params: { storeId: 's1' } as Request['params'],
    });
    await roleGuard(['vendedora'])(req, makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenStoreError);
  });

  it('non-admin with the wrong role is rejected with ForbiddenRoleError', async () => {
    dbModule.__findFirst.mockResolvedValue({ role: 'vendedora' });
    const next = jest.fn();
    const req = makeReq({
      auth: { userId: 'u1', isAdmin: false },
      params: { storeId: 's1' } as Request['params'],
    });
    await roleGuard(['encargada'])(req, makeRes(), next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenRoleError);
  });

  it('non-admin with the right role passes', async () => {
    dbModule.__findFirst.mockResolvedValue({ role: 'vendedora' });
    const next = jest.fn();
    const req = makeReq({
      auth: { userId: 'u1', isAdmin: false },
      params: { storeId: 's1' } as Request['params'],
    });
    await roleGuard(['vendedora'])(req, makeRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });
});
