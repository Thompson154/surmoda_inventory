import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { InventoryRow } from '@surmoda/contracts';
import { inventoryService } from '../services/inventoryService';
import { Alert, Button, Input, Modal, ProductCodeBadge } from '@/shared/ui';
import { BarcodeScanner, type BarcodeScannerHandle } from '@/shared/components/BarcodeScanner';
import { formatBs } from '@/shared/format/currency';
import { sizeLabel } from '@/shared/format/sizeLabel';
import { getImageUrl } from '@/features/products/services/productsService';
import { useDebounce } from '@/shared/hooks/useDebounce';

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
  const [candidates, setCandidates] = useState<InventoryRow[]>([]);
  const debouncedCode = useDebounce(code, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BarcodeScannerHandle | null>(null);
  const requestSeqRef = useRef(0);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    requestSeqRef.current += 1;
    setCode('');
    setError(null);
    setInfo(null);
    setPending(false);
    setCandidates([]);
  }, [open]);

  // Live variant suggestions as operator types partial/original product code.
  useEffect(() => {
    if (!open) return;
    const trimmed = debouncedCode.trim();
    if (trimmed.length < 2) return;
    const seq = requestSeqRef.current;
    let cancelled = false;
    void inventoryService
      .searchCandidates(storeId, trimmed)
      .then((rows) => {
        if (!cancelled && seq === requestSeqRef.current && rows.length > 0) {
          setCandidates(rows);
        }
      })
      .catch(() => {
        // Silent during live typing; explicit Buscar/Enter reports real errors.
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeId, debouncedCode]);

  const submit = async (rawCode: string, fromCamera: boolean) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    requestSeqRef.current += 1;
    setPending(true);
    setError(null);
    setCandidates([]);
    setInfo(fromCamera ? `Detectado: ${trimmed}` : null);
    try {
      const result = await inventoryService.resolveCodeOrSearch(storeId, trimmed);
      if (result.kind === 'exact_barcode') {
        onResolved(result.row);
        onClose();
        return;
      }
      if (result.kind === 'variants') {
        setCandidates(result.rows);
        return;
      }
      setError(`Código "${trimmed}" no registrado en esta sede.`);
      // Don't keep retrying the same not-found code — extend the cooldown
      // to 10s so the cashier sees the error and has time to move the
      // camera off the bad label.
      scannerRef.current?.markHandled(trimmed, 10_000);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      setError(e.message ?? 'No pudimos verificar el código.');
      scannerRef.current?.markHandled(trimmed, 5_000);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Escanear código de barras">
      <div className="flex flex-col gap-3">
        <BarcodeScanner handleRef={scannerRef} onDetected={(c) => void submit(c, true)} />

        <div>
          <label htmlFor="barcode-input" className="text-sm font-medium text-text-secondary">
            O escribilo manualmente (barras o código de prenda)
          </label>
          <Input
            id="barcode-input"
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (candidates.length > 0) setCandidates([]);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(code, false);
            }}
            placeholder="Pegá o escribí el código..."
            className="mt-1 font-mono uppercase"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        {candidates.length > 0 && (
          <div className="rounded-lg border border-surface-border bg-surface-sunken/70 p-2.5 flex flex-col gap-2">
            <p className="text-xs font-semibold text-text-primary">
              Variantes encontradas ({candidates.length}) — elegí una prenda
            </p>
            <ul className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {candidates.map((v) => {
                const img = getImageUrl(v.imagePath);
                return (
                  <li key={v.variantId}>
                    <button
                      type="button"
                      onClick={() => {
                        onResolved(v);
                        onClose();
                      }}
                      className="w-full flex items-center gap-2.5 rounded-md border border-surface-border bg-surface-raised px-2.5 py-2 text-left hover:border-brand-primary/50 hover:bg-surface-sunken transition-colors"
                    >
                      <div className="h-9 w-9 shrink-0 rounded bg-surface-sunken border border-surface-border flex items-center justify-center overflow-hidden">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-text-subtle" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ProductCodeBadge
                            code={v.productCode}
                            className="text-[11px] px-1.5 py-0"
                          />
                          <span className="text-xs font-semibold text-text-primary truncate">
                            {v.productName}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted truncate mt-0.5">
                          {sizeLabel(v.size)} · <span className="capitalize">{v.color}</span> ·{' '}
                          {formatBs(v.priceCents)}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-text-secondary shrink-0">
                        Stock: {v.quantity}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
