import { z } from 'zod';

const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';

// WHY: Zod .default() solo aplica a undefined, no a string vacío. Vite a veces
// expone la env var como "" y eso rompía url() → throw → black screen al boot.
const EnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .transform((v) => (v.trim() === '' ? DEFAULT_API_BASE : v))
    .pipe(z.string().url())
    .default(DEFAULT_API_BASE),
  VITE_BUILD_VERSION: z.string().optional(),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    // WHY: warn + fallback en lugar de throw — un env mal seteado no debe
    // causar pantalla negra en boot; el FE usa el default y sigue.
    console.warn(
      '[config] Variables de entorno inválidas, usando defaults:',
      parsed.error.flatten().fieldErrors,
    );
    return { VITE_API_BASE_URL: DEFAULT_API_BASE, VITE_BUILD_VERSION: undefined };
  }
  return parsed.data;
}

export const config = loadEnv();
