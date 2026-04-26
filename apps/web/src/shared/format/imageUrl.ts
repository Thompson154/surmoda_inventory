// Variant images come from the BE either as absolute URLs (Cloudinary in prod)
// or relative repo paths (local dev seed). Normalise both to a browser-loadable href.

export function resolveImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  if (/^https?:/i.test(imagePath)) return imagePath;
  return `/${imagePath.replace(/^\/+/, '')}`;
}
