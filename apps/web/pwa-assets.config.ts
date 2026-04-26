// Generates PWA icon assets (favicon, apple-touch-icon, maskable, transparent)
// from a single SVG source. Run via: `npx pwa-assets-generator`.
//
// The generator writes the PNG variants to apps/web/public/. We commit those
// outputs to the repo so production builds don't need to re-rasterize.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
});
