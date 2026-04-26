import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { errorHandler } from '../errorHandler';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/constants/errorCodes';

interface ResMock {
  statusCode?: number;
  body?: unknown;
  status: jest.Mock;
  json: jest.Mock;
}

function buildResMock(): ResMock {
  const res = {} as ResMock;
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((b: unknown) => {
    res.body = b;
    return res;
  });
  return res;
}

function asRes(m: ResMock): Response {
  return m as unknown as Response;
}

describe('errorHandler', () => {
  const req = {} as Request;
  const next = jest.fn() as unknown as NextFunction;

  it('maps AppError to its statusCode + code + message', () => {
    const res = buildResMock();
    const err = new AppError(409, ERROR_CODES.USER_CREATE_DUPLICATE_EMAIL, 'duplicate');
    errorHandler(err, req, asRes(res), next);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual(
      expect.objectContaining({ code: 'USER_CREATE_DUPLICATE_EMAIL', message: 'duplicate' }),
    );
  });

  it('maps ZodError to 400 VALIDATION_ERROR with issues', () => {
    const res = buildResMock();
    const err = new ZodError([{ code: 'custom', path: ['email'], message: 'Required' } as never]);
    errorHandler(err, req, asRes(res), next);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking the message', () => {
    const res = buildResMock();
    const err = new Error('database exploded with secret leaking');
    errorHandler(err, req, asRes(res), next);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    expect(JSON.stringify(res.body)).not.toContain('secret leaking');
  });
});
