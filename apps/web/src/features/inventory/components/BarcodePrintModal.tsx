import { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Alert, Button, Input, Modal } from '@/shared/ui';
import { sizeLabel } from '@/shared/format/sizeLabel';

interface BarcodePrintModalProps {
  open: boolean;
  onClose: () => void;
  barcode: string;
  productCode: string;
  productName?: string | null;
  productDescription?: string | null;
  size: string;
  color: string;
}

const MIN_COPIES = 1;
const MAX_COPIES = 60;

/**
 * Renders a Code-128 barcode (standard format, scannable by any reader) and
 * lets the operator pick how many copies to print on a single A4 sheet of
 * adhesive labels (4 columns). Print-only CSS hides everything except the
 * label grid so the printer driver outputs just the labels.
 *
 * Header of the printed sheet shows productCode + (optional) description so
 * the operator can confirm she's printing the right model before sending it
 * to the printer.
 */
export function BarcodePrintModal({
  open,
  onClose,
  barcode,
  productCode,
  productName,
  productDescription,
  size,
  color,
}: BarcodePrintModalProps) {
  const [copies, setCopies] = useState(12);
  const previewRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Repaint the SVG preview whenever the barcode changes or the modal opens.
  useEffect(() => {
    if (!open) return;
    const svg = previewRef.current;
    if (!svg) return;
    try {
      JsBarcode(svg, barcode, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 14,
        height: 60,
        margin: 4,
      });
      setRenderError(null);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'No se pudo generar el código.');
    }
  }, [open, barcode]);

  const printArray = useMemo(
    () => Array.from({ length: Math.max(MIN_COPIES, Math.min(MAX_COPIES, copies)) }),
    [copies],
  );

  const handlePrint = () => window.print();

  const sheetTitle = productCode + (productDescription ? ` — ${productDescription}` : productName ? ` — ${productName}` : '');
  const variantLine = `${sizeLabel(size)} · ${color}`;

  return (
    <Modal isOpen={open} onClose={onClose} title="Imprimir código">
      <div className="flex flex-col gap-3">
        {/* On-screen preview (hidden during print) */}
        <div className="screen-only flex flex-col gap-2 items-center rounded-lg border border-surface-border bg-white p-3">
          <p className="text-xs text-slate-500">Vista previa</p>
          <svg ref={previewRef} className="w-full max-w-[260px]" />
          <p className="text-xs text-slate-700 font-mono">{barcode}</p>
          <p className="text-xs text-slate-500">
            {productCode} · {variantLine}
          </p>
        </div>

        {renderError && <Alert variant="error">{renderError}</Alert>}

        <div className="screen-only flex items-center gap-3">
          <label htmlFor="bc-copies" className="text-sm font-semibold">
            Copias por hoja
          </label>
          <Input
            id="bc-copies"
            type="number"
            min={MIN_COPIES}
            max={MAX_COPIES}
            value={String(copies)}
            onChange={(e) =>
              setCopies(Math.max(MIN_COPIES, Math.min(MAX_COPIES, Number(e.target.value) || 1)))
            }
            className="w-24 text-sm py-1"
          />
          <span className="text-xs text-slate-500">grilla 4 col · etiqueta adhesiva A4</span>
        </div>

        <div className="screen-only flex justify-end gap-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="h-4 w-4" />}
          >
            Imprimir
          </Button>
        </div>

        {/* Print-only sheet — hidden on screen, visible only during window.print(). */}
        <div className="print-sheet">
          <header className="print-header">
            <h1>{sheetTitle}</h1>
            <p>
              {variantLine} · {printArray.length} etiqueta{printArray.length === 1 ? '' : 's'}
            </p>
          </header>
          <div className="print-grid">
            {printArray.map((_, i) => (
              <BarcodeCell
                key={i}
                value={barcode}
                productCode={productCode}
                variantLine={variantLine}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Print CSS — kept inline to keep the component self-contained. */}
      <style>{`
        .print-sheet { display: none; }
        @media print {
          @page { size: A4; margin: 8mm; }
          body * { visibility: hidden; }
          .print-sheet, .print-sheet * { visibility: visible; }
          .print-sheet {
            display: block;
            position: absolute;
            inset: 0;
            color: #000;
            background: #fff;
            font-family: ui-sans-serif, system-ui, sans-serif;
          }
          .print-header { margin-bottom: 4mm; border-bottom: 1px solid #000; padding-bottom: 2mm; }
          .print-header h1 { font-size: 11pt; font-weight: 700; margin: 0; }
          .print-header p { font-size: 8pt; margin: 0.5mm 0 0; color: #555; }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 2mm;
          }
          .print-cell {
            border: 0.2mm dashed #ccc;
            padding: 2mm;
            text-align: center;
            page-break-inside: avoid;
          }
          .print-cell svg { width: 100%; height: 14mm; }
          .print-cell .code { font-size: 7pt; font-family: ui-monospace, monospace; margin-top: 1mm; }
          .print-cell .desc { font-size: 6pt; color: #555; }
          .screen-only { display: none !important; }
        }
      `}</style>
    </Modal>
  );
}

function BarcodeCell({
  value,
  productCode,
  variantLine,
}: {
  value: string;
  productCode: string;
  variantLine: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        displayValue: false,
        height: 50,
        margin: 0,
      });
    } catch {
      // ignore — preview already shows the error
    }
  }, [value]);
  return (
    <div className="print-cell">
      <svg ref={ref} />
      <p className="code">{value}</p>
      <p className="desc">{productCode} · {variantLine}</p>
    </div>
  );
}
