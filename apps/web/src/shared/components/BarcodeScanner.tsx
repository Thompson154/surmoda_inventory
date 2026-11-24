import { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, FlashlightOff, ScanLine } from 'lucide-react';
import {
  BarcodeDetector as PolyfillBarcodeDetector,
  setZXingModuleOverrides,
} from '@sec-ant/barcode-detector';
import { Button } from '@/shared/ui';

// Override the wasm location so it is fetched locally from the PWA/host instead of an external CDN
setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => {
    if (path.endsWith('.wasm')) {
      return '/zxing_reader.wasm';
    }
    return prefix + path;
  },
});

const SUPPORTED_FORMATS = ['code_128', 'ean_13', 'code_39', 'qr_code', 'upc_a', 'ean_8'] as const;

export interface BarcodeScannerHandle {
  markHandled: (code: string, cooldownMs?: number) => void;
}

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  pollMs?: number;
  defaultCooldownMs?: number;
  hint?: string;
  handleRef?: React.MutableRefObject<BarcodeScannerHandle | null>;
}

interface DetectorInstance {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
}

export function BarcodeScanner({
  onDetected,
  pollMs = 150,
  defaultCooldownMs = 1500,
  hint = 'Apuntá la cámara al código',
  handleRef,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<DetectorInstance | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);
  // code → expiry timestamp (ms). Reads while still in the future are dropped.
  const handledRef = useRef<Map<string, number>>(new Map());

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [justDetected, setJustDetected] = useState(false);

  // Expose imperative handle so parents can extend the cooldown for a code
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
    setTorchOn(false);
    setHasTorch(false);
    isScanningRef.current = false;
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

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (
        track as unknown as { applyConstraints: (c: unknown) => Promise<void> }
      ).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch {
      // Ignored if torch cannot be toggled
    }
  };

  const initDetector = async (): Promise<DetectorInstance> => {
    if (detectorRef.current) return detectorRef.current;

    // 1. Try native browser BarcodeDetector if available and supports code_128
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const NativeBD = (window as unknown as { BarcodeDetector: typeof PolyfillBarcodeDetector })
          .BarcodeDetector;
        const nativeFormats = await NativeBD.getSupportedFormats();
        if (nativeFormats && nativeFormats.includes('code_128')) {
          const nativeInst = new NativeBD({
            formats: ['code_128', 'ean_13', 'qr_code'],
          });
          detectorRef.current = nativeInst as unknown as DetectorInstance;
          return nativeInst as unknown as DetectorInstance;
        }
      } catch {
        // Fall back to WASM polyfill
      }
    }

    // 2. Use WASM polyfill backed by local /zxing_reader.wasm
    const polyfillInst = new PolyfillBarcodeDetector({
      formats: [...SUPPORTED_FORMATS],
    });
    detectorRef.current = polyfillInst as unknown as DetectorInstance;
    return polyfillInst as unknown as DetectorInstance;
  };

  const startCamera = async () => {
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Tu navegador o conexión no permite acceso a la cámara (requiere HTTPS).');
      return;
    }

    try {
      await initDetector();
    } catch {
      setCameraError('No se pudo inicializar el lector de códigos de barra.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check for torch capability and attempt continuous focus
      const track = stream.getVideoTracks()[0];
      if (track && typeof track.getCapabilities === 'function') {
        const capabilities = track.getCapabilities() as {
          torch?: boolean;
          focusMode?: string[];
        };
        if (capabilities?.torch) {
          setHasTorch(true);
        }
        if (capabilities?.focusMode?.includes('continuous') && track.applyConstraints) {
          track
            .applyConstraints({
              advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
            })
            .catch(() => undefined);
        }
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        video.onloadedmetadata = () => {
          video.play().catch(() => undefined);
        };
        await video.play().catch(() => undefined);
      }

      setCameraOn(true);

      pollTimerRef.current = window.setInterval(async () => {
        const vid = videoRef.current;
        if (!vid || vid.readyState < 2 || !detectorRef.current || isScanningRef.current) return;

        isScanningRef.current = true;
        try {
          const codes = await detectorRef.current.detect(vid);
          if (codes && codes.length > 0) {
            const detected = codes[0]!.rawValue;
            if (detected) {
              const expiry = handledRef.current.get(detected);
              const now = Date.now();
              if (expiry === undefined || now >= expiry) {
                handledRef.current.set(detected, now + defaultCooldownMs);

                // Haptic feedback on detection (safe-guarded for mobile)
                if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                  try {
                    navigator.vibrate(50);
                  } catch {
                    // Ignore if blocked by browser policy
                  }
                }

                // Visual flash
                setJustDetected(true);
                setTimeout(() => setJustDetected(false), 400);

                onDetected(detected);
              }
            }
          }
        } catch {
          // Ignore intermittent frame decode errors
        } finally {
          isScanningRef.current = false;
        }
      }, pollMs);
    } catch (err) {
      const e = err as Error;
      if (e.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Habilitá el permiso en el navegador.');
      } else if (e.name === 'NotFoundError') {
        setCameraError('No se encontró cámara en este dispositivo.');
      } else {
        setCameraError(e.message || 'No se pudo iniciar la cámara.');
      }
    }
  };

  return (
    <div
      className={`relative aspect-video w-full rounded-2xl border-2 border-dashed bg-slate-950 overflow-hidden shadow-inner transition-colors duration-300 ${
        justDetected
          ? 'border-status-success ring-4 ring-status-success/30'
          : 'border-surface-border'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
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
          {cameraError && (
            <p className="text-[11px] text-status-danger mt-1 text-center max-w-xs">
              {cameraError}
            </p>
          )}
        </div>
      )}
      {cameraOn && (
        <>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
                className="rounded-full bg-black/60 backdrop-blur-xs text-white p-1.5 hover:bg-black/80 active:scale-95 transition-all"
              >
                {torchOn ? (
                  <FlashlightOff className="h-4 w-4 text-amber-400" />
                ) : (
                  <Flashlight className="h-4 w-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCameraOn(false)}
              className="rounded-full bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 hover:bg-black/80 active:scale-95 transition-all"
            >
              Apagar
            </button>
          </div>

          {/* Viewfinder reticle */}
          <div className="absolute inset-4 sm:inset-6 pointer-events-none flex flex-col justify-between">
            <div className="flex justify-between">
              <div
                className={`h-6 w-6 border-t-2 border-l-2 rounded-tl-lg transition-colors ${
                  justDetected
                    ? 'border-status-success shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                    : 'border-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                }`}
              />
              <div
                className={`h-6 w-6 border-t-2 border-r-2 rounded-tr-lg transition-colors ${
                  justDetected
                    ? 'border-status-success shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                    : 'border-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                }`}
              />
            </div>

            <div className="relative w-full h-0">
              <div
                className={`absolute inset-x-2 -top-0.5 h-0.5 bg-gradient-to-r from-transparent via-brand-primary to-transparent animate-laser-scan shadow-[0_0_10px_rgba(99,102,241,0.8)] ${
                  justDetected ? 'opacity-0' : 'opacity-100'
                }`}
              />
            </div>

            <div className="flex justify-between">
              <div
                className={`h-6 w-6 border-b-2 border-l-2 rounded-bl-lg transition-colors ${
                  justDetected
                    ? 'border-status-success shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                    : 'border-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                }`}
              />
              <div
                className={`h-6 w-6 border-b-2 border-r-2 rounded-br-lg transition-colors ${
                  justDetected
                    ? 'border-status-success shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                    : 'border-brand-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                }`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
