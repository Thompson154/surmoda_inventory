export const MAX_COMPRESSED_IMAGE_BYTES = 95 * 1024;
const MAX_INPUT_RAW_BYTES = 25 * 1024 * 1024;

const DIMENSION_STEPS = [1024, 800, 640, 480, 360] as const;
const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45, 0.34] as const;

export interface CompressedImageResult {
  file: File;
  dataUrl: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = url;
  });
}

async function decodeImage(
  file: File,
): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        close: () => bitmap.close(),
      };
    } catch {
      // Fallback to HTMLImageElement if createImageBitmap fails for the file format.
    }
  }
  const img = await loadHtmlImage(file);
  return {
    width: img.naturalWidth || img.width || 800,
    height: img.naturalHeight || img.height || 800,
    draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    close: () => {},
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

function replaceExt(filename: string, ext: string): string {
  const stem = filename.replace(/\.[^.]+$/, '') || 'imagen';
  return `${stem}.${ext}`;
}

/**
 * Resize and compress a user-picked image (camera or gallery) so it stays
 * strictly under ~100 KB (`MAX_COMPRESSED_IMAGE_BYTES`) before upload.
 */
export async function compressImage(
  file: File,
  maxBytes: number = MAX_COMPRESSED_IMAGE_BYTES,
): Promise<CompressedImageResult> {
  if (file.size > MAX_INPUT_RAW_BYTES) {
    throw new Error('La imagen supera 25 MB.');
  }

  // Non-DOM or small test environments without 2D canvas fall back to original small file.
  if (typeof document === 'undefined') {
    return { file, dataUrl: await readAsDataUrl(file) };
  }
  const probeCanvas = document.createElement('canvas');
  if (typeof probeCanvas.getContext !== 'function') {
    return { file, dataUrl: await readAsDataUrl(file) };
  }
  let has2d = false;
  try {
    has2d = Boolean(probeCanvas.getContext('2d'));
  } catch {
    has2d = false;
  }
  if (!has2d) {
    return { file, dataUrl: await readAsDataUrl(file) };
  }

  const decoded = await decodeImage(file);
  try {
    const srcW = Math.max(1, decoded.width);
    const srcH = Math.max(1, decoded.height);
    const longest = Math.max(srcW, srcH);

    let smallestBlob: Blob | null = null;
    let smallestMime: 'image/webp' | 'image/jpeg' = 'image/jpeg';

    for (const maxDim of DIMENSION_STEPS) {
      const scale = longest > maxDim ? maxDim / longest : 1;
      const targetW = Math.max(1, Math.round(srcW * scale));
      const targetH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      decoded.draw(ctx, targetW, targetH);

      for (const mime of ['image/webp', 'image/jpeg'] as const) {
        for (const quality of QUALITY_STEPS) {
          const blob = await canvasToBlob(canvas, mime, quality);
          if (!blob || blob.type !== mime) continue;
          if (!smallestBlob || blob.size < smallestBlob.size) {
            smallestBlob = blob;
            smallestMime = mime;
          }
          if (blob.size <= maxBytes) {
            const ext = mime === 'image/webp' ? 'webp' : 'jpg';
            const outFile = new File([blob], replaceExt(file.name, ext), { type: mime });
            return { file: outFile, dataUrl: await readAsDataUrl(outFile) };
          }
        }
      }
    }

    if (smallestBlob) {
      const ext = smallestMime === 'image/webp' ? 'webp' : 'jpg';
      const outFile = new File([smallestBlob], replaceExt(file.name, ext), { type: smallestMime });
      return { file: outFile, dataUrl: await readAsDataUrl(outFile) };
    }

    return { file, dataUrl: await readAsDataUrl(file) };
  } finally {
    decoded.close();
  }
}

export async function compressImageToFile(
  file: File,
  maxBytes: number = MAX_COMPRESSED_IMAGE_BYTES,
): Promise<File> {
  const result = await compressImage(file, maxBytes);
  return result.file;
}

export async function compressImageToDataUrl(
  file: File,
  maxBytes: number = MAX_COMPRESSED_IMAGE_BYTES,
): Promise<CompressedImageResult> {
  return compressImage(file, maxBytes);
}
