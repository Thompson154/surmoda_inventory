import { useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Alert, Button, Input, Modal } from '@/shared/ui';
import { httpClient } from '@/shared/services/httpClient';
import type { InventoryRow } from '@surmoda/contracts';

interface BarcodeScannerModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
  /** Called when a barcode resolves to a real variant in this store. */
  onResolved: (row: InventoryRow) => void;
}

/**
 * Manual barcode entry modal. The real camera-driven scanner will replace the input
 * in feature 008 — until then the encargada/vendedora can type or paste the code.
 */
export function BarcodeScannerModal({ storeId, open, onClose, onResolved }: BarcodeScannerModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
      setPending(false);
      return;
    }
    // Slight delay so the modal can mount before focusing.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      const row = await httpClient.get<InventoryRow>(
        `/stores/${storeId}/inventory/by-barcode/${encodeURIComponent(trimmed)}`,
      );
      onResolved(row);
      onClose();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'STOCK_BARCODE_NOT_FOUND') {
        setError('No encontramos este código en esta sede.');
      } else {
        setError(e.message ?? 'No pudimos verificar el código.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Escanear código de barras">
      <div className="flex flex-col gap-3">
        <div className="aspect-square rounded-xl border-2 border-dashed border-surface-border bg-surface-sunken flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <ScanLine className="h-12 w-12" />
            <p className="text-xs">Cámara: próximamente</p>
            <p className="text-[10px] text-slate-400">(escribí o pegá el código por ahora)</p>
          </div>
        </div>

        <div>
          <label htmlFor="barcode-input" className="text-sm font-medium text-slate-700">
            Agregá el código de barra
          </label>
          <Input
            id="barcode-input"
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
            placeholder="Pegá o escribí el código..."
            className="mt-1 font-mono"
            autoComplete="off"
          />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={() => void submit()}
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
