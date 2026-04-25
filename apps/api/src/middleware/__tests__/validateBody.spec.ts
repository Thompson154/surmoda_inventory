import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../validateBody';

const Schema = z.object({ email: z.string().email(), password: z.string().min(8) });

function makeRes(): Response {
  const res: Record<string, unknown> = {};
  res.status = jest.fn().mockImplementation((_code: number) => res);
  res.json = jest.fn().mockImplementation((_b: unknown) => res);
  return res as unknown as Response;
}

describe('validateBody', () => {
  it('passes on valid body and replaces req.body with parsed data', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { body: { email: 'a@b.com', password: '12345678' } } as Request;
    validateBody(Schema)(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ email: 'a@b.com', password: '12345678' });
  });

  it('forwards a ZodError to next on invalid body', () => {
    const next = jest.fn() as unknown as NextFunction;
    const req = { body: { email: 'not-an-email', password: 'short' } } as Request;
    validateBody(Schema)(req, makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((next as unknown as jest.Mock).mock.calls[0]?.[0]).toBeDefined();
  });
});
