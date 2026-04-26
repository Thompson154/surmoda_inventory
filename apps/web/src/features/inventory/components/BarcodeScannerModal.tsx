import { useEffect, useRef, useState } from 'react';
import type { InventoryRow } from '@surmoda/contracts';
import { Alert, Button, Input, Modal } from '@/shared/ui';
import { httpClient } from '@/shared/services/httpClient';
import { BarcodeScanner, type BarcodeScannerHandle } from '@/shared/components/BarcodeScanner';

interface BarcodeScannerModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
  /** Called when a barcode resolves to a real variant in this store. */
  onResolved: (row: InventoryRow) => void;
}

/**
 * Camera-driven barcode scanner with manual-entry fallback.
 *
 * Flow: BarcodeScanner detects a code → fetch /inventory/by-barcode/:code.
 * 200 → onResolved + close. 404 → inline error AND `markHandled` on the
 * scanner with a long cooldown so the same not-found code doesn't re-fire
 * every 120ms (which is what made the old version feel sluggish).
 */
export function BarcodeScannerModal({
  storeId,
  open,
  onClose,
  onResolved,
}: BarcodeScannerModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BarcodeScannerHandle | null>(null);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    setCode('');
    setError(null);
    setInfo(null);
    setPending(false);
  }, [open]);

  const submit = async (rawCode: string, fromCamera: boolean) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    setInfo(fromCamera ? `Detectado: ${trimmed}` : null);
    try {
      const row = await httpClient.get<InventoryRow>(
        `/stores/${storeId}/inventory/by-barcode/${encodeURIComponent(trimmed)}`,
      );
      onResolved(row);
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'STOCK_BARCODE_NOT_FOUND') {
        setError(`Código "${trimmed}" no registrado en esta sede.`);
        // Don't keep retrying the same not-found code — extend the cooldown
        // to 10s so the cashier sees the error and has time to move the
        // camera off the bad label.
        scannerRef.current?.markHandled(trimmed, 10_000);
      } else {
        setError(e.message ?? 'No pudimos verificar el código.');
        scannerRef.current?.markHandled(trimmed, 5_000);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Escanear código de barras">
      <div className="flex flex-col gap-3">
        <BarcodeScanner handleRef={scannerRef} onDetected={(c) => void submit(c, true)} />

        <div>
          <label htmlFor="barcode-input" className="text-sm font-medium text-slate-700">
            O escribilo manualmente
          </label>
          <Input
            id="barcode-input"
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(code, false);
            }}
            placeholder="Pegá o escribí el código..."
            className="mt-1 font-mono uppercase"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        {info && <Alert variant="info">{info}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => void submit(code, false)}
          isLoading={pending}
          disabled={!code.trim() || pending}
          className="w-full"
        >
          Buscar
        </Button>
      </div>
    </Modal>
  );
}
