// Bidirectional maps between Prisma's generated enum types and the public
// contract enum strings shipped via @surmoda/contracts. Centralised so the FE
// never sees Prisma-specific enum identifiers (e.g. `size_30`) and BE callers
// don't keep redefining the same lookup tables.

import type { PaymentMethod as PrismaPaymentMethod, Size as PrismaSize } from '@prisma/client';
import type { PaymentMethod, Size } from '@surmoda/contracts';

export const SIZE_FROM_PRISMA: Record<PrismaSize, Size> = {
  s: 's',
  m: 'm',
  l: 'l',
  xl: 'xl',
  xxl: 'xxl',
  size_28: '28',
  size_30: '30',
  size_32: '32',
  size_34: '34',
  standard: 'standard',
};

export const PM_FROM_PRISMA: Record<PrismaPaymentMethod, PaymentMethod> = {
  qr: 'qr',
  card: 'card',
  cash: 'cash',
};

export const PM_TO_PRISMA: Record<PaymentMethod, PrismaPaymentMethod> = {
  qr: 'qr',
  card: 'card',
  cash: 'cash',
};
