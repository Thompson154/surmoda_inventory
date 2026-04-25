# 01 — Resumen Ejecutivo

## 1. Problema del negocio

**Surmoda** es una cadena de indumentaria femenina y masculina con sede en La Paz, Bolivia, que opera actualmente dos puntos de venta (sucursales Prado y Zona Sur) y un almacén central de distribución. El ciclo operativo del negocio comprende la recepción de mercadería en el almacén, la distribución por entrega hacia cada tienda y la venta al público final.

Hasta el inicio de este proyecto, la gestión de stock se realizaba íntegramente con planillas de cálculo (Microsoft Excel) que cada encargada de tienda mantenía de manera independiente. Este esquema presentaba las siguientes problemáticas verificadas:

- **Desactualización del stock en tiempo real.** Las planillas se actualizaban de forma manual y diferida, lo que generaba discrepancias entre el inventario registrado y el stock físico disponible. Las diferencias se detectaban únicamente al cierre de mes o ante un pedido que no podía atenderse.
- **Errores de concordancia entre sedes.** Al distribuir mercadería desde el almacén central, los movimientos de salida e ingreso se registraban en archivos distintos sin ningún mecanismo de sincronización. Era frecuente que el saldo en el almacén no coincidiera con la suma de los ingresos declarados por las tiendas.
- **Ausencia de trazabilidad de ventas.** No existía un registro sistemático de ventas por producto, talla o color. El análisis de rotación se realizaba comparando el stock inicial con el final al cierre de ciclo, sin detalle de transacciones individuales.
- **Proceso de cierre de caja manual y propenso a errores.** Al finalizar cada jornada, la encargada sumaba manualmente los importes por método de pago (efectivo, QR, tarjeta). La ausencia de un sistema centralizado hacía que los cierres tardaran entre 30 y 60 minutos y que los errores aritméticos fueran habituales.
- **Sin control de acceso diferenciado.** Cualquier usuario con acceso a las planillas compartidas podía modificar registros históricos sin dejar rastro. No había distinción entre el rol de encargada (responsable de una tienda) y el de vendedora (solo ventas, sin visibilidad de dashboards).

El impacto económico estimado incluye pérdidas por desabastecimiento (ventas perdidas por falta de talla/color disponible), pérdidas por diferencias de inventario no detectadas a tiempo y costo de horas-persona dedicadas a conciliación manual de planillas.

---

## 2. Solución propuesta

**Surmoda Inventory** es un sistema web / PWA (Progressive Web App) orientado a dispositivos móviles que digitaliza el ciclo completo del negocio: desde la gestión de usuarios y control de acceso hasta las ventas diarias y el cierre de caja automatizado.

La solución se articula en los siguientes componentes funcionales:

1. **Autenticación y control de acceso basado en roles (RBAC).** Tres roles diferenciados: *admin* (acceso global), *encargada* (acceso a sus tiendas asignadas) y *vendedora* (solo operación de venta en su tienda). Sesión persistente con JWT de corta duración y refresh token rotativo con detección de replay.

2. **Gestión de inventario por sede.** Cada tienda y el almacén central mantienen un stock independiente. El stock se identifica a nivel de variante (combinación talla + color) con código de barras único.

3. **Entregas (almacén → tienda).** Flujo de transferencia que decrementa el stock del almacén e incrementa el de la tienda destino; crea el registro si el producto aún no existe en la tienda.

4. **Movimientos (audit log de inventario).** Registro inmutable de toda operación CRUD sobre el inventario de una sede, accesible para admin y encargada.

5. **Ventas por escaneo de barcode.** La vendedora escanea el código del producto; el sistema verifica stock, registra la venta y aplica el método de pago (QR, tarjeta, efectivo).

6. **Cierre de día automatizado.** Genera un reporte diario inmutable con desglose por método de pago. Un cron de servidor cierra automáticamente el día a medianoche si la encargada olvidó hacerlo.

---

## 3. Alcance del proyecto

### Entregado (Feature 001 — branch `main`)

- Registro de usuarios por admin (US1: admin onboarding).
- Login con JWT + refresh token rotativo (US2).
- Logout con revocación del token (US3).
- Gestión de asignaciones usuario-tienda y desactivación de cuentas (US4).
- Reset de contraseña por admin (US5).
- Pipeline CI completo (lint, type-check, pruebas, build, migraciones).
- 71 pruebas unitarias BE + 36 pruebas de componente FE.

### Planificado para la defensa (Features 002-009)

| Feature | Descripción |
|---------|-------------|
| 002 | Gestión de tiendas y almacén (alta, listado, sede activa) |
| 003 | Catálogo de productos con variantes y barcode |
| 004 | Inventario por sede (altas, bajas, ajustes) |
| 005 | Entregas almacén → tienda |
| 006 | Registro de ventas (scanner, desglose por pago) |
| 007 | Cierre de día + reporte diario + cron de cierre automático |
| 008 | Dashboard de reportes semanales para admin |
| 009 | PWA offline-first y soporte de escaneo nativo |

Las features 002-007 están en scope para la defensa. Las features 008 y 009 son de valor adicional y están condicionadas al tiempo disponible.

---

## 4. Stakeholders

| Rol | Descripción |
|-----|-------------|
| **Dueño de Surmoda** | Patrocinador del proyecto. Define requerimientos de negocio. Acceso de admin. |
| **Encargadas de tienda** | Usuarias primarias del módulo de inventario, entregas y cierre de caja. Rol *encargada*. |
| **Vendedoras** | Usuarias del punto de venta (scanner). Rol *vendedora*. |
| **Autor del proyecto** | Diseñador, arquitecto y desarrollador principal. |
| **Tribunal de defensa** | Evaluadores del Proyecto de Grado (Universidad Mayor de San Andrés / institución pertinente). |

---

## 5. Resultados esperados

- **Reducción del tiempo de cierre de caja** de 30-60 minutos a menos de 5 minutos, gracias al registro en tiempo real de ventas y al cierre automatizado.
- **Trazabilidad completa de movimientos** de inventario por sede, con capacidad de auditoría histórica indefinida (tabla `audit_logs` append-only).
- **Eliminación de diferencias de inventario** no detectadas, mediante la reconciliación automática almacén-tienda en cada entrega.
- **Control de acceso granular**, eliminando la posibilidad de modificación no autorizada de datos.
- **Base de datos de ventas** que permite análisis de rotación por producto, talla, color y sede.

---

## 6. Limitaciones conocidas

Las siguientes capacidades están fuera del alcance de este proyecto de grado y se declaran explícitamente para evitar expectativas incorrectas:

- **No incluye gestión financiera ni contable.** El sistema registra ventas y cierre de caja, pero no reemplaza ningún sistema de contabilidad, facturación electrónica ni declaración tributaria.
- **No incluye e-commerce público.** El sistema es de uso interno exclusivo del personal de Surmoda. No existe interfaz de venta al público final.
- **No incluye gestión de proveedores ni órdenes de compra.** El módulo de almacén gestiona el stock existente; el ingreso de mercadería nueva es un proceso manual fuera de scope.
- **Arquitectura single-tenant.** El sistema está diseñado para una sola empresa (Surmoda). No se implementa multi-tenancy.
- **Sin soporte offline completo en esta iteración.** La feature PWA offline-first (Feature 009) está planificada pero no garantizada para la defensa.
- **Moneda fija en Bolivianos (Bs).** No se implementa soporte multi-moneda.
