import { useEffect, useRef, useState } from 'react';
import { useCreateReturnRequest } from '@/features/return-requests/hooks/useReturnRequests';
import { ConfirmDialog, Input, Modal, useToast } from '@/shared/ui';
import { useErrorMessage } from '@/shared/hooks/useErrorMessage';
import type { HttpError } from '@/shared/services/httpClient';
import { BarcodeScanner, type BarcodeScannerHandle } from '@/shared/components/BarcodeScanner';
import { ReturnRequestForm } from '@/features/return-requests/components/ReturnRequestForm';
import type { CreateReturnRequestPayload } from '@/features/return-requests/types';

interface ReturnScannerModalProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
}

export function ReturnScannerModal({ storeId, open, onClose }: ReturnScannerModalProps) {
  const [barcode, setBarcode] = useState('');
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<CreateReturnRequestPayload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<BarcodeScannerHandle | null>(null);
  const createRequest = useCreateReturnRequest();
  const toast = useToast();
  const spanishError = useErrorMessage(createRequest.error as HttpError | null | undefined);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    // WHY: reset all state on close so modal opens fresh next time
    setBarcode('');
    setScanInfo(null);
    setPendingPayload(null);
    createRequest.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDetected = (code: string) => {
    setBarcode(code.trim().toUpperCase());
    setScanInfo(`Detectado: ${code.trim()}`);
    scannerRef.current?.markHandled(code, 5_000);
  };

  // WHY: form calls onSubmit to stage payload; modal shows ConfirmDialog before mutating
  function handleFormSubmit(payload: CreateReturnRequestPayload) {
    setPendingPayload(payload);
  }

  function handleConfirm() {
    if (!pendingPayload) return;
    createRequest.mutate(pendingPayload, {
      onSuccess: () => {
        toast.success('Solicitud enviada');
        setPendingPayload(null);
        onClose();
      },
      onError: () => {
        setPendingPayload(null);
        toast.error(spanishError ?? 'No pudimos enviar la solicitud.');
      },
    });
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Solicitar devolución">
      <div className="flex flex-col gap-4">
        <BarcodeScanner handleRef={scannerRef} onDetected={handleDetected} />

        {/* Barcode scan / manual entry */}
        <div>
          <label htmlFor="return-barcode-input" className="text-sm font-medium text-text-secondary">
            Código de barras
          </label>
          <Input
            id="return-barcode-input"
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.toUpperCase())}
            placeholder="Pegá o escribí el código..."
            className="mt-1 font-mono uppercase"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        {scanInfo && <p className="text-xs text-text-muted">{scanInfo}</p>}

        {/* WHY: always show the full 3-section form so user fills all required fields */}
        <ReturnRequestForm
          storeId={storeId}
          prefilledBarcode={barcode.trim() || undefined}
          onSubmit={handleFormSubmit}
          isPending={createRequest.isPending}
        />

        <ConfirmDialog
          open={Boolean(pendingPayload)}
          onClose={() => setPendingPayload(null)}
          onConfirm={handleConfirm}
          title="Mandar solicitud al admin"
          description="Esta solicitud queda pendiente de aprobación. Se va a registrar en el historial."
          confirmLabel="Confirmar"
          variant="default"
          isPending={createRequest.isPending}
        />
      </div>
    </Modal>
  );
}
