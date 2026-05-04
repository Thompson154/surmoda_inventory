// Modal para configurar y lanzar un reporte de ventas.
// Flujo: presets → dates → opciones → submit → onPreviewReady(data)

import { useState, useMemo, useEffect } from 'react';
import { DateRangePresets, type PresetKey } from './DateRangePresets';
import { useGenerateReportPreview } from '../hooks/useGenerateReport';
import { toIsoStartOfDay, toIsoEndOfDay } from '../utils/dateRange';
import type { GenerateReportArgs, SalesReportPreview } from '../types';
import { Alert, Button, Modal } from '@/shared/ui';
import type { HttpError } from '@/shared/services/httpClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  // Bolivia is UTC-4
  const local = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function presetDates(key: PresetKey, today: string): { from: string; to: string } {
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: shiftDays(today, -6), to: today };
    case '1m':
      return { from: shiftMonths(today, -1), to: today };
    case '4m':
      return { from: shiftMonths(today, -4), to: today };
    case '6m':
      return { from: shiftMonths(today, -6), to: today };
    default:
      return { from: shiftDays(today, -6), to: today };
  }
}

function monthsBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00.000Z`);
  const t = new Date(`${to}T00:00:00.000Z`);
  return (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
}

function errorMessage(err: HttpError | null): string {
  if (!err) return '';
  if (err.status === 403) return 'No tenés permiso para esta sucursal.';
  if (err.status === 400) return 'Periodo inválido o parámetros incorrectos.';
  return 'Error generando reporte. Intentá de nuevo.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  onPreviewReady: (preview: SalesReportPreview, args: GenerateReportArgs) => void;
}

export function ReportGeneratorModal({
  isOpen,
  onClose,
  storeId,
  storeName,
  onPreviewReady,
}: ReportGeneratorModalProps) {
  const today = useMemo(() => todayIso(), []);
  const [preset, setPreset] = useState<PresetKey>('7d');
  const [from, setFrom] = useState(shiftDays(today, -6));
  const [to, setTo] = useState(today);
  const [includePaymentSummary, setIncludePaymentSummary] = useState(true);
  const [includeInventory, setIncludeInventory] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Query args — null until user submits
  const [queryArgs, setQueryArgs] = useState<GenerateReportArgs | null>(null);

  const query = useGenerateReportPreview(queryArgs);

  // When a preset changes, auto-fill the dates
  function handlePresetChange(key: PresetKey) {
    setPreset(key);
    if (key !== 'custom') {
      const dates = presetDates(key, today);
      setFrom(dates.from);
      setTo(dates.to);
    }
  }

  // When preview arrives, notify parent and reset query
  useEffect(() => {
    if (query.isSuccess && query.data && queryArgs) {
      setQueryArgs(null);
      onPreviewReady(query.data, queryArgs);
    }
  }, [query.isSuccess, query.data, queryArgs, onPreviewReady]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!from || !to) {
      setValidationError('Seleccioná un rango de fechas.');
      return;
    }
    if (from > to) {
      setValidationError('La fecha de inicio debe ser anterior a la fecha de fin.');
      return;
    }
    if (to > today) {
      setValidationError('La fecha de fin no puede ser posterior a hoy.');
      return;
    }
    if (monthsBetween(from, to) > 12) {
      setValidationError('El rango no puede superar 12 meses.');
      return;
    }

    setQueryArgs({
      storeId,
      from: toIsoStartOfDay(from),
      to: toIsoEndOfDay(to),
      includePaymentSummary,
      includeInventory,
    });
  }

  function handleClose() {
    setQueryArgs(null);
    setValidationError(null);
    onClose();
  }

  const isLoading = query.isFetching;
  const serverError = query.isError ? errorMessage(query.error as HttpError) : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Generar Reporte de Ventas">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Store subtitle */}
        <p className="text-sm text-text-muted -mt-2">
          Sucursal: <span className="font-semibold text-text-primary">{storeName}</span>
        </p>

        {/* Period section */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Periodo</p>
          <DateRangePresets selected={preset} onChange={handlePresetChange} />

          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label htmlFor="report-from" className="text-xs text-text-muted">
                Desde
              </label>
              <input
                id="report-from"
                type="date"
                value={from}
                max={to || today}
                readOnly={preset !== 'custom'}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9 rounded-md border border-surface-border bg-surface-raised px-3 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50"
                style={{ colorScheme: 'auto' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="report-to" className="text-xs text-text-muted">
                Hasta
              </label>
              <input
                id="report-to"
                type="date"
                value={to}
                min={from}
                max={today}
                readOnly={preset !== 'custom'}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded-md border border-surface-border bg-surface-raised px-3 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50"
                style={{ colorScheme: 'auto' }}
              />
            </div>
          </div>
        </div>

        {/* Options section */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Opciones</p>

          <div className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-text-secondary">Incluir resumen por método de pago</span>
            <ToggleSwitch
              checked={includePaymentSummary}
              onChange={setIncludePaymentSummary}
              id="toggle-payment"
            />
          </div>

          <div className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-text-secondary">Incluir inventario actual</span>
            <ToggleSwitch
              checked={includeInventory}
              onChange={setIncludeInventory}
              id="toggle-inventory"
            />
          </div>
        </div>

        {/* Errors */}
        {validationError && <Alert variant="error">{validationError}</Alert>}
        {serverError && <Alert variant="error">{serverError}</Alert>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {isLoading ? 'Generando vista previa...' : 'Generar vista previa'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}

function ToggleSwitch({ checked, onChange, id }: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
        checked ? 'bg-brand-primary' : 'bg-surface-border-strong',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md',
          'transform transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}
