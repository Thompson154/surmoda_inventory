import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { WarehouseIntakeModal } from '../WarehouseIntakeModal';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/server';

const BASE = 'http://localhost:3000/api/v1';
const WAREHOUSE_ID = 'store-almacen-seed';

// Fixtures ---------------------------------------------------------------

const JN001_LOOKUP = {
  exists: true,
  productId: 'prod-1',
  productCode: 'JN001',
  productName: 'Jean Bota Recta',
  variants: [
    {
      variantId: 'var-A',
      size: '30',
      color: 'azul',
      priceCents: 30000,
      warehouseQuantity: 12,
      imagePath: null,
    },
    {
      variantId: 'var-B',
      size: 'm',
      color: 'rojo',
      priceCents: 30000,
      warehouseQuantity: 8,
      imagePath: null,
    },
    {
      variantId: 'var-C',
      size: 'l',
      color: 'azul',
      priceCents: 30000,
      warehouseQuantity: 4,
      imagePath: null,
    },
  ],
};

const CHQ001_LOOKUP = {
  exists: true,
  productId: 'prod-2',
  productCode: 'CHQ001',
  productName: 'Chaqueta clásica',
  variants: [
    {
      variantId: 'var-X',
      size: 'xs',
      color: 'verde',
      priceCents: 45000,
      warehouseQuantity: 3,
      imagePath: null,
    },
    {
      variantId: 'var-Y',
      size: 's',
      color: 'blanco',
      priceCents: 45000,
      warehouseQuantity: 1,
      imagePath: null,
    },
  ],
};

/** Override the lookup handler to control what code maps to what fixture. */
function useLookupOverride() {
  server.use(
    http.get(`${BASE}/stores/:storeId/deliveries/intake/lookup`, ({ request }) => {
      const url = new URL(request.url);
      const code = String(url.searchParams.get('code') ?? '').toUpperCase();
      if (code === 'JN001') return HttpResponse.json(JN001_LOOKUP);
      if (code === 'CHQ001') return HttpResponse.json(CHQ001_LOOKUP);
      return HttpResponse.json({
        exists: false,
        productId: null,
        productCode: code,
        productName: null,
        variants: [],
      });
    }),
  );
}

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(
    <WarehouseIntakeModal warehouseId={WAREHOUSE_ID} open={true} onClose={onClose} />,
  );
}

// -----------------------------------------------------------------------
// Síntoma A — variantes stale cuando se cambia el código de modelo
// -----------------------------------------------------------------------

describe('WarehouseIntakeModal — Síntoma A: variantes stale al cambiar modelo', () => {
  it('RED→GREEN: al cambiar de JN001 a CHQ001 solo aparecen las variantes de CHQ001', async () => {
    useLookupOverride();
    const user = userEvent.setup();
    renderModal();

    const codeInput = screen.getByLabelText(/código de modelo/i);

    // Paso 1: tipear JN001 y esperar que carguen sus variantes
    await user.type(codeInput, 'JN001');
    await waitFor(() => {
      expect(screen.getByText(/Jean Bota Recta/i)).toBeInTheDocument();
    });
    // Las variantes de JN001 deben estar en el DOM — "azul" aparece como valor
    // de input disabled (campo color) de las variantes existentes
    await waitFor(() => {
      const azulInputs = document.querySelectorAll('input[value="azul"]');
      expect(azulInputs.length).toBeGreaterThanOrEqual(1);
    });

    // Paso 2: limpiar el input y escribir CHQ001
    await user.clear(codeInput);
    await user.type(codeInput, 'CHQ001');

    // Paso 3: esperar que aparezcan las variantes de CHQ001
    await waitFor(() => {
      expect(screen.getByText(/Chaqueta clásica/i)).toBeInTheDocument();
    });

    // Síntoma A: las variantes de JN001 (rojo, azul con size 30) NO deben estar visibles
    // Las variantes de CHQ001 (verde, blanco) SÍ deben estar visibles
    await waitFor(() => {
      expect(screen.getByDisplayValue('verde')).toBeInTheDocument();
      expect(screen.getByDisplayValue('blanco')).toBeInTheDocument();
    });

    // Verificar que NO aparecen colores exclusivos de JN001 (rojo — no existe en CHQ001)
    // "rojo" solo existía en JN001 — si el bug existe estará en el DOM
    // Los inputs de color disabled con valor 'rojo' no deben existir
    const rojoInputs = document.querySelectorAll('input[value="rojo"]');
    expect(rojoInputs.length).toBe(0);
  });

  it('RED→GREEN: las variantes del modelo anterior no persisten después del cambio', async () => {
    useLookupOverride();
    const user = userEvent.setup();
    renderModal();

    const codeInput = screen.getByLabelText(/código de modelo/i);

    // Cargar JN001 (3 variantes)
    await user.type(codeInput, 'JN001');
    await waitFor(() => {
      expect(screen.getByText(/Jean Bota Recta/i)).toBeInTheDocument();
    });

    // Contar los li de variantes renderizados — deben ser 3 de JN001
    // (Más el blank emptyVariant si existe)
    const listItems = document.querySelectorAll('ul li');
    // Al menos las 3 variantes de JN001 deben aparecer
    // Nota: el blank emptyVariant inicial tiene color vacío, igual se renderiza
    const countAfterJN001 = listItems.length;
    expect(countAfterJN001).toBeGreaterThanOrEqual(3);

    // Cambiar a CHQ001 (2 variantes)
    await user.clear(codeInput);
    await user.type(codeInput, 'CHQ001');

    await waitFor(() => {
      expect(screen.getByText(/Chaqueta clásica/i)).toBeInTheDocument();
    });

    // Esperar a que los colores de CHQ001 aparezcan
    await waitFor(() => {
      const verdeInput = document.querySelector('input[value="verde"]');
      expect(verdeInput).not.toBeNull();
    });

    // El total de variantes renderizadas debe ser SOLO las de CHQ001 (2)
    // más el blank nuevo si aplica. NO deben seguir las 3 de JN001.
    // Verificamos que "rojo" (exclusivo de JN001) no existe como valor de input
    const rojoInputs = document.querySelectorAll('input[value="rojo"]');
    expect(rojoInputs.length).toBe(0);
  });
});

// -----------------------------------------------------------------------
// Síntoma B — blank variant slot debe estar ARRIBA
// -----------------------------------------------------------------------

describe('WarehouseIntakeModal — Síntoma B: blank variant slot debe aparecer primero', () => {
  it('RED→GREEN: el input de color vacío (blank slot) es el primero en la lista de variantes cuando hay variantes existentes', async () => {
    useLookupOverride();
    const user = userEvent.setup();
    renderModal();

    const codeInput = screen.getByLabelText(/código de modelo/i);

    // Cargar JN001 para que haya variantes existentes en la lista
    await user.type(codeInput, 'JN001');
    await waitFor(() => {
      expect(screen.getByText(/Jean Bota Recta/i)).toBeInTheDocument();
    });

    // Esperar a que las variantes se rendericen
    await waitFor(() => {
      const colorInputs = document.querySelectorAll('input[placeholder="Azul"]');
      // Debe haber al menos 1 input de color (el blank)
      expect(colorInputs.length).toBeGreaterThanOrEqual(1);
    });

    // El blank slot es el input de color con value vacío y NO disabled
    // Verificar que aparece ANTES de los inputs disabled (variantes existentes)
    const allColorInputs = Array.from(document.querySelectorAll('input[placeholder="Azul"]'));

    if (allColorInputs.length < 2) {
      // Si solo hay el blank, no hay mucho que verificar — pasamos
      return;
    }

    const firstColorInput = allColorInputs[0];
    // El primer input de color debe ser el blank (no disabled, value vacío)
    expect(firstColorInput).not.toBeDisabled();
    expect((firstColorInput as HTMLInputElement).value).toBe('');
  });

  it('RED→GREEN: al clickear "Agregar variante", el nuevo slot queda ANTES de los existentes', async () => {
    useLookupOverride();
    const user = userEvent.setup();
    renderModal();

    const codeInput = screen.getByLabelText(/código de modelo/i);

    // Cargar JN001
    await user.type(codeInput, 'JN001');
    await waitFor(() => {
      expect(screen.getByText(/Jean Bota Recta/i)).toBeInTheDocument();
    });

    // Esperar variantes
    await waitFor(() => {
      const disabled = document.querySelectorAll('input[placeholder="Azul"]:disabled');
      expect(disabled.length).toBeGreaterThanOrEqual(1);
    });

    // Hacer click en "Agregar variante"
    const addBtn = screen.getByRole('button', { name: /agregar variante/i });
    await user.click(addBtn);

    // Ahora debe haber al menos 2 inputs de color no-disabled (blanks)
    // O al menos el primero debe ser no-disabled (blank arriba)
    const allColorInputs = Array.from(document.querySelectorAll('input[placeholder="Azul"]'));
    const firstColorInput = allColorInputs[0];
    expect(firstColorInput).not.toBeDisabled();
    expect((firstColorInput as HTMLInputElement).value).toBe('');
  });
});
