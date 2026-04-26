// Human-readable labels for the canonical Size contract enum.

import type { Size } from '@surmoda/contracts';

const SIZE_LABEL: Record<string, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
  xxl: 'XXL',
  '28': '28',
  '30': '30',
  '32': '32',
  '34': '34',
  standard: 'Estándar',
};

export function sizeLabel(size: Size | string): string {
  return SIZE_LABEL[size] ?? size;
}
