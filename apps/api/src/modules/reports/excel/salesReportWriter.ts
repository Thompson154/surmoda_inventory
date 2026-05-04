// Streaming Excel writer for the sales report.
// Uses exceljs.stream.xlsx.WorkbookWriter to write directly to the HTTP response
// stream — no temp files, no full memory buffer. Safe for large reports.
//
// WHY streaming: a 12-month report for a busy boutique can have thousands of
// sale lines. Loading them all into memory before writing would risk OOM on
// low-RAM deployments. Cursor-based iteration + WorkbookWriter avoids that.

import type { Stream } from 'node:stream';
import ExcelJS from 'exceljs';
import type { SalesReportRepository } from '../salesReport.repository';
import type { StoreInfo, PaymentSummary, InventorySection } from '../salesReport.types';

const XLSX_PAGE_SIZE = 500;

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Convert integer cents to Bs with 2 decimal places. */
function centsToBs(cents: number): number {
  return Math.round(cents) / 100;
}

/** Excel number format that displays values as "Bs 200,50". */
const BS_NUM_FMT = '"Bs" #,##0.00';

export interface WriteSalesReportXlsxArgs {
  stream: NodeJS.WritableStream;
  store: StoreInfo;
  from: Date;
  to: Date;
  includePaymentSummary: boolean;
  includeInventory: boolean;
  paymentSummary?: PaymentSummary;
  inventory?: InventorySection;
  reports: SalesReportRepository;
  generatedAt: Date;
}

export async function writeSalesReportXlsx({
  stream,
  store,
  from,
  to,
  includePaymentSummary,
  includeInventory,
  paymentSummary,
  inventory,
  reports,
  generatedAt,
}: WriteSalesReportXlsxArgs): Promise<void> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: stream as unknown as Stream,
    // useStyles must be true so that cell numFmt (Bs formatting) is serialized
    // into the shared styles XML. With false, cell.numFmt is ignored.
    useStyles: true,
    useSharedStrings: false,
  });

  // ── Sheet 1: Ventas ──────────────────────────────────────────────────────────

  const salesSheet = workbook.addWorksheet('Ventas');

  // WHY: sin width explícito Excel usa ~10 chars y "Bs 12,345.67" se renderiza
  // como ##### porque no cabe. Las columnas monetarias necesitan 16 chars y las
  // de texto largo (variante, vendedora) 18-22.
  salesSheet.columns = [
    { width: 12 }, // Fecha
    { width: 9 }, // Hora
    { width: 12 }, // Ticket
    { width: 14 }, // Código
    { width: 22 }, // Variante
    { width: 12 }, // Color
    { width: 9 }, // Talla
    { width: 10 }, // Cantidad
    { width: 16 }, // Precio Unitario
    { width: 16 }, // Subtotal
    { width: 14 }, // Método de Pago
    { width: 20 }, // Vendedora
  ];

  // Header rows
  salesSheet.addRow([`Reporte de Ventas - Sucursal ${store.name} (${store.code})`]).commit();
  salesSheet.addRow([`Periodo: ${formatDate(from)} al ${formatDate(to)}`]).commit();
  salesSheet.addRow([`Generado: ${generatedAt.toISOString()}`]).commit();
  salesSheet.addRow([]).commit(); // blank separator

  // Column headers
  salesSheet
    .addRow([
      'Fecha',
      'Hora',
      'Ticket',
      'Código',
      'Variante',
      'Color',
      'Talla',
      'Cantidad',
      'Precio Unitario',
      'Subtotal',
      'Método de Pago',
      'Vendedora',
    ])
    .commit();

  // Cursor-based iteration over all sales (no 50-row cap — this is xlsx, not preview)
  let cursor: string | undefined = undefined;
  let grandTotal = 0;

  while (true) {
    const { rows, lastCursor } = await reports.getSalesBatch(
      store.id,
      from,
      to,
      XLSX_PAGE_SIZE,
      cursor,
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const excelRow = salesSheet.addRow([
        row.saleDate,
        row.saleTime,
        row.ticketNumber,
        row.productCode,
        row.variantDescription,
        row.color,
        row.size,
        row.quantity,
        centsToBs(row.unitPriceCents),
        centsToBs(row.subtotalCents),
        row.paymentMethod,
        row.cashier,
      ]);
      // Apply Bs format to price columns (9 = Precio Unitario, 10 = Subtotal)
      excelRow.getCell(9).numFmt = BS_NUM_FMT;
      excelRow.getCell(10).numFmt = BS_NUM_FMT;
      excelRow.commit();
      grandTotal += row.subtotalCents;
    }

    cursor = lastCursor;
    if (!cursor) break;
  }

  // Total row
  salesSheet.addRow([]).commit();
  const totalRow = salesSheet.addRow([
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL',
    centsToBs(grandTotal),
    '',
    '',
  ]);
  totalRow.getCell(10).numFmt = BS_NUM_FMT;
  totalRow.commit();

  salesSheet.commit();

  // ── Sheet 2: Resumen de pagos (optional) ────────────────────────────────────

  if (includePaymentSummary && paymentSummary) {
    const pmSheet = workbook.addWorksheet('Resumen de pagos');
    pmSheet.columns = [
      { width: 14 }, // Método
      { width: 16 }, // Total (Bs)
      { width: 12 }, // Porcentaje
    ];
    pmSheet.addRow(['Método', 'Total (Bs)', 'Porcentaje']).commit();

    const total = paymentSummary.total || 1; // avoid division by zero
    const methods: Array<[string, number]> = [
      ['Efectivo', paymentSummary.cash],
      ['Tarjeta', paymentSummary.card],
      ['QR', paymentSummary.qr],
    ];

    for (const [method, amount] of methods) {
      const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
      const pmRow = pmSheet.addRow([method, centsToBs(amount), `${pct}%`]);
      pmRow.getCell(2).numFmt = BS_NUM_FMT;
      pmRow.commit();
    }

    const pmTotalRow = pmSheet.addRow(['TOTAL', centsToBs(paymentSummary.total), '100%']);
    pmTotalRow.getCell(2).numFmt = BS_NUM_FMT;
    pmTotalRow.commit();
    pmSheet.commit();
  }

  // ── Sheet 3: Inventario actual (optional) ────────────────────────────────────

  if (includeInventory && inventory) {
    const invSheet = workbook.addWorksheet('Inventario actual');
    invSheet.columns = [
      { width: 14 }, // Código
      { width: 22 }, // Variante
      { width: 12 }, // Color
      { width: 9 }, // Talla
      { width: 10 }, // Cantidad
      { width: 16 }, // Precio (Bs)
    ];
    invSheet.addRow([`Inventario al ${inventory.capturedAt.toISOString()}`]).commit();
    invSheet.addRow([]).commit();
    invSheet.addRow(['Código', 'Variante', 'Color', 'Talla', 'Cantidad', 'Precio (Bs)']).commit();

    for (const row of inventory.rows) {
      const invRow = invSheet.addRow([
        row.productCode,
        row.variantDescription,
        row.color,
        row.size,
        row.quantity,
        centsToBs(row.unitPriceCents),
      ]);
      invRow.getCell(6).numFmt = BS_NUM_FMT;
      invRow.commit();
    }

    invSheet.addRow([]).commit();
    invSheet.addRow(['', '', '', 'TOTALES', inventory.totalUnits, '']).commit();
    invSheet.addRow([`Variantes: ${inventory.totalVariants}`, '', '', '', '', '']).commit();

    invSheet.commit();
  }

  await workbook.commit();
}
