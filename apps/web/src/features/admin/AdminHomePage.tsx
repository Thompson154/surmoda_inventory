import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Camera,
  ChevronRight,
  FileSpreadsheet,
  Package,
  ScrollText,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent } from '@/shared/ui';
import { AppShell } from '@/shared/layout/AppShell';
import { useStores } from '@/features/stores/hooks/useStores';
import { httpClient } from '@/shared/services/httpClient';
import { useToast } from '@/shared/ui/toast';
import { ReportGeneratorModal } from '@/features/reports/components/ReportGeneratorModal';
import { ReportPreviewModal } from '@/features/reports/components/ReportPreviewModal';
import type { SalesReportPreview, GenerateReportArgs } from '@/features/reports/types';

// ─── Store picker sub-modal ───────────────────────────────────────────────────

interface StorePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (storeId: string, storeName: string) => void;
}

function StorePickerModal({ isOpen, onClose, onSelect }: StorePickerModalProps) {
  const stores = useStores({ kind: 'branch' });
  const [selected, setSelected] = useState('');

  if (!isOpen) return null;

  const branches = stores.data?.items ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative z-10 bg-surface-raised border border-glass-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-text-primary mb-4">Seleccionar sucursal</h2>
        <select
          className="w-full h-9 rounded-md border border-surface-border bg-surface-base px-3 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— elegir sucursal —</option>
          {branches.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selected}
            onClick={() => {
              const store = branches.find((s) => s.id === selected);
              if (store) onSelect(store.id, store.name);
            }}
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── AdminHomePage ────────────────────────────────────────────────────────────

export function AdminHomePage() {
  const toast = useToast();

  // Snapshot mutation
  const snapshotMutation = useMutation({
    mutationFn: () => httpClient.post<{ snapshotted: number }>('/inventory-snapshots'),
    onSuccess: (data) => {
      toast.success(`Snapshot capturado: ${data.snapshotted} variantes registradas.`);
    },
    onError: () => {
      toast.error('Error capturando snapshot. Intentá de nuevo.');
    },
  });

  const [confirmSnapshot, setConfirmSnapshot] = useState(false);

  // Report flow: store picker → generator → preview
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [reportStore, setReportStore] = useState<{ id: string; name: string } | null>(null);
  const [reportGeneratorOpen, setReportGeneratorOpen] = useState(false);
  const [reportPreview, setReportPreview] = useState<SalesReportPreview | null>(null);
  const [reportArgs, setReportArgs] = useState<GenerateReportArgs | null>(null);

  function handleStoreSelected(storeId: string, storeName: string) {
    setStorePickerOpen(false);
    setReportStore({ id: storeId, name: storeName });
    setReportGeneratorOpen(true);
  }

  function handlePreviewReady(preview: SalesReportPreview, args: GenerateReportArgs) {
    setReportGeneratorOpen(false);
    setReportPreview(preview);
    setReportArgs(args);
  }

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 text-text-primary">
        <header className="flex flex-col gap-1">
          <Link
            to="/sedes"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a sucursales
          </Link>
          <h1 className="text-xl font-semibold">Panel admin</h1>
          <p className="text-sm text-text-muted">
            Gestión maestra del sistema. Aquí solo entra el admin.
          </p>
        </header>

        <Link to="/users" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Gestionar usuarios</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Crear, editar y desactivar cuentas
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-subtle shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/stores" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <StoreIcon className="h-5 w-5 text-text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Gestionar tiendas</p>
                  <p className="text-xs text-text-muted mt-0.5">Sucursales y almacén central</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-subtle shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/products" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Gestionar catálogo</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Productos, variantes, precios e imágenes
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-subtle shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/reportes" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Reportes</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Análisis cross-sucursal — ventas, top productos, ranking de vendedoras
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-subtle shrink-0" />
            </CardContent>
          </Card>
        </Link>

        <Link to="/auditoria" className="block">
          <Card className="hover:bg-surface-sunken transition-colors duration-150">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <ScrollText className="h-5 w-5 text-text-subtle mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">Auditoría del sistema</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Log inmutable de acciones — login, ediciones, ventas, entregas
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-text-subtle shrink-0" />
            </CardContent>
          </Card>
        </Link>

        {/* ── Herramientas admin ──────────────────────────────────────────────── */}

        <div className="border-t border-surface-border pt-2">
          <p className="text-xs uppercase tracking-wider text-text-muted font-semibold mb-3 px-1">
            Herramientas
          </p>

          {/* Generar reporte por sucursal */}
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Generar reporte de ventas
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    Seleccioná una sucursal y generá el Excel
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setStorePickerOpen(true)}>
                Abrir
              </Button>
            </CardContent>
          </Card>

          {/* Snapshot de inventario */}
          <Card className="mt-2">
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Camera className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Capturar snapshot de inventario
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      Registra el stock actual de todas las sucursales para los reportes
                    </p>
                  </div>
                </div>
                {!confirmSnapshot ? (
                  <Button variant="secondary" size="sm" onClick={() => setConfirmSnapshot(true)}>
                    Capturar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmSnapshot(false)}>
                      No
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={snapshotMutation.isPending}
                      onClick={() => {
                        setConfirmSnapshot(false);
                        snapshotMutation.mutate();
                      }}
                    >
                      Sí, capturar
                    </Button>
                  </div>
                )}
              </div>
              {confirmSnapshot && (
                <Alert variant="warning" className="text-xs">
                  Esto registrará el stock actual de todas las sucursales. ¿Confirmás?
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modals */}
        <StorePickerModal
          isOpen={storePickerOpen}
          onClose={() => setStorePickerOpen(false)}
          onSelect={handleStoreSelected}
        />
        {reportStore && (
          <ReportGeneratorModal
            isOpen={reportGeneratorOpen}
            onClose={() => {
              setReportGeneratorOpen(false);
              setReportStore(null);
            }}
            storeId={reportStore.id}
            storeName={reportStore.name}
            onPreviewReady={handlePreviewReady}
          />
        )}
        {reportPreview && (
          <ReportPreviewModal
            isOpen={!!reportPreview}
            onClose={() => {
              setReportPreview(null);
              setReportArgs(null);
            }}
            preview={reportPreview}
            downloadArgs={reportArgs ?? undefined}
          />
        )}
      </main>
    </AppShell>
  );
}
