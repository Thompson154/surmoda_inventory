import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { BarcodeDetector } from '@sec-ant/barcode-detector';
import { Button } from '@/shared/ui';

const SUPPORTED_FORMATS = [
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'qr_code',
] as const;

export interface BarcodeScannerHandle {
  /** Mark a code as "already handled" — won't fire onDetected again until the
   *  cooldown elapses. Useful when the parent did an HTTP check and doesn't
   *  want a 404 to re-trigger every poll. */
  markHandled: (code: string, cooldownMs?: number) => void;
}

interface BarcodeScannerProps {
  /** Called every time a NEW code is detected (after de-dup). */
  onDetected: (code: string) => void;
  /** Internal poll interval in ms. Default 120ms — fast enough that a steady
   *  hand on a printed label resolves in ~1 frame. */
  pollMs?: number;
  /**
   * How long to ignore the same code after first detection (ms). Default 1500.
   * The parent can override per-code via the imperative handle when a code is
   * known-not-found, so the camera doesn't keep submitting it.
   */
  defaultCooldownMs?: number;
  /** Visual label shown above the camera. */
  hint?: string;
  /** Imperative ref so the parent can mark a code as handled (e.g. after a
   *  404 response) and avoid re-triggering on the next poll. */
  handleRef?: React.MutableRefObject<BarcodeScannerHandle | null>;
}

/**
 * Camera-driven barcode scanner. Self-contained: handles getUserMedia, the
 * BarcodeDetector loop, lifecycle (mount/unmount, tab background), and
 * de-duplication of repeated reads.
 *
 * Design choices vs. the previous inline implementation:
 *   - Polls at 120ms (was 250ms) — feels "instant" without burning battery.
 *   - Does NOT stop the camera on detect. The parent keeps the stream alive
 *     and uses `markHandled(code)` to prevent the same code from re-firing.
 *   - Maintains a small "recently handled" map keyed by code so a 404 doesn't
 *     spam the network on every subsequent poll.
 */
export function BarcodeScanner({
  onDetected,
  pollMs = 120,
  defaultCooldownMs = 1500,
  hint = 'Apuntá la cámara al código',
  handleRef,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  // code → expiry timestamp (ms). Reads while still in the future are dropped.
  const handledRef = useRef<Map<string, number>>(new Map());

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Expose imperative handle so parents can extend the cooldown for a code
  // they've already processed (e.g. after a "not found" HTTP error).
  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      markHandled: (code, cooldownMs) => {
        handledRef.current.set(code, Date.now() + (cooldownMs ?? defaultCooldownMs));
      },
    };
    return () => {
      if (handleRef.current) handleRef.current = null;
    };
  }, [handleRef, defaultCooldownMs]);

  // Stop camera + polling whenever cameraOn flips off.
  useEffect(() => {
    if (cameraOn) return;
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, [cameraOn]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    if (!detectorRef.current) {
      try {
        detectorRef.current = new BarcodeDetector({ formats: [...SUPPORTED_FORMATS] });
      } catch {
        setCameraError('Tu navegador no soporta el escaneo de códigos.');
        return;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraOn(true);

      pollTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !detectorRef.current) return;
        try {
          const codes = await detectorRef.current.detect(video);
          if (codes.length === 0) return;
          const detected = codes[0]!.rawValue;
          const expiry = handledRef.current.get(detected);
          const now = Date.now();
          if (expiry !== undefined && now < expiry) return;
          handledRef.current.set(detected, now + defaultCooldownMs);

          // Haptic feedback on detection (safe-guarded for mobile)
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(40);
            } catch {
              // Ignore if blocked by browser policy
            }
          }

          onDetected(detected);
        } catch {
          // Ignore intermittent decode errors
        }
      }, pollMs);
    } catch (err) {
      const e = err as Error;
      if (e.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado.');
      } else if (e.name === 'NotFoundError') {
        setCameraError('No se encontró cámara en este dispositivo.');
      } else {
        setCameraError(e.message || 'No se pudo iniciar la cámara.');
      }
    }
  };

  return (
    <div className="relative aspect-video w-full rounded-2xl border-2 border-dashed border-surface-border bg-slate-950 overflow-hidden shadow-inner">
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
          cameraOn ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {!cameraOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-subtle p-4">
          <ScanLine className="h-10 w-10 text-brand-primary/70 animate-pulse" />
          <p className="text-xs text-text-muted">{hint}</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void startCamera()}
            leftIcon={<Camera className="h-4 w-4" />}
          >
            Encender cámara
          </Button>
          {cameraError && <p className="text-[11px] text-status-danger mt-1">{cameraError}</p>}
        </div>
      )}
      {cameraOn && (
        <>
          <button
            type="button"
            onClick={() => setCameraOn(false)}
            className="absolute top-3 right-3 z-10 rounded-full bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 hover:bg-black/80 active:scale-95 transition-all"
          >
            Apagar
          </button>

          {/* Viewfinder reticle & GPU-accelerated laser */}
          <div className="absolute inset-4 sm:inset-6 pointer-events-none flex flex-col justify-between">
            {/* Top corners */}
            <div className="flex justify-between">
              <div className="h-6 w-6 border-t-2 border-l-2 border-brand-primary rounded-tl-lg shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <div className="h-6 w-6 border-t-2 border-r-2 border-brand-primary rounded-tr-lg shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            </div>

            {/* Laser scanning line */}
            <div className="relative w-full h-0">
              <div className="absolute inset-x-2 -top-0.5 h-0.5 bg-gradient-to-r from-transparent via-brand-primary to-transparent animate-laser-scan shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
            </div>

            {/* Bottom corners */}
            <div className="flex justify-between">
              <div className="h-6 w-6 border-b-2 border-l-2 border-brand-primary rounded-bl-lg shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <div className="h-6 w-6 border-b-2 border-r-2 border-brand-primary rounded-br-lg shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
