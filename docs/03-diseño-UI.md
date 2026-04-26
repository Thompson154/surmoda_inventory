# 03 — Sistema de Diseño UI

## Filosofía: belleza operacional, no estética de lujo

Surmoda es una herramienta de trabajo. Las vendedoras la usan ocho horas por día, en teléfonos Android de gama media, bajo iluminación fluorescente. El diseño responde a esas condiciones: **claridad antes que ornamentación**.

Las referencias son Linear, Stripe Dashboard, Shopify Admin y Notion. Todos son productos que hacen trabajo complejo parecer simple. Ninguno usa sombras dramáticas, gradientes llamativos ni tipografías de display. En cambio, invierten en:

- Jerarquía visual limpia mediante espacio y peso tipográfico
- Retroalimentación inmediata (hover, focus, loading states)
- Consistencia exhaustiva de tokens (mismo color de borde en todos lados)
- Accesibilidad como restricción de diseño, no como característica adicional

Lo que explícitamente **no** hacemos: landing pages, glassmorphism, animaciones de scroll, paletas de colores "vivas", tipografías decorativas.

---

## Sistema de tokens

### Colores

El sistema usa tres familias semánticas. Los valores concretos viven en `apps/web/src/styles/index.css` bajo `@theme`.

#### Brand

| Token | Valor | Uso |
|-------|-------|-----|
| `brand-primary` | `#4f46e5` | Botón principal, focus ring, links activos |
| `brand-primary-hover` | `#4338ca` | Estado hover del botón primario |
| `brand-primary-active` | `#3730a3` | Estado active/pressed del botón primario |
| `brand-primary-soft` | `#eef2ff` | Fondo suave para áreas seleccionadas |

#### Surface

| Token | Valor | Uso |
|-------|-------|-----|
| `surface-base` | `#f8fafc` | Fondo de página |
| `surface-raised` | `#ffffff` | Cards, modales |
| `surface-sunken` | `#f1f5f9` | Hover de filas, fondos de inputs deshabilitados |
| `surface-border` | `#e2e8f0` | Bordes de cards y separadores |
| `surface-border-strong` | `#cbd5e1` | Bordes de inputs y selects |

#### Status

| Token | Valor | Uso |
|-------|-------|-----|
| `status-success` / `status-success-soft` | `#059669` / `#d1fae5` | Confirmaciones, badges verdes |
| `status-warning` / `status-warning-soft` | `#d97706` / `#fef3c7` | Advertencias |
| `status-danger` / `status-danger-soft` | `#dc2626` / `#fee2e2` | Errores, acciones destructivas |
| `status-info` / `status-info-soft` | `#0284c7` / `#e0f2fe` | Información contextual |

### Tipografía

Se usa **system font stack** — sin descarga de fuentes externas. En iOS renderiza San Francisco, en Android Roboto, en Windows Segoe UI.

```css
font-family-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
font-family-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
```

`font-feature-settings: 'cv11', 'ss01'` está activo en `:root` para habilitar cifras tabulares y alternativas contextuales (mejora la legibilidad de números en tablas de inventario).

### Espaciado

Se usa la escala de espaciado estándar de Tailwind (4px base). No se añaden valores customizados — la grilla de 4px cubre todos los casos sin complejidad adicional.

### Motion

| Token | Valor | Uso |
|-------|-------|-----|
| `duration-150` | `150ms` | Hovers, transiciones de color |
| `duration-250` | `250ms` | Entradas/salidas de elementos |
| `duration-400` | `400ms` | Animaciones de estado complejas |
| `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Transiciones de color y opacidad |
| `ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | Elementos que "aterrizan" en pantalla |

#### Animaciones disponibles

```
animate-fade-in    — 150ms, aparición suave
animate-slide-up   — 250ms, entra desde abajo
animate-slide-down — 250ms, entra desde arriba
animate-scale-in   — 150ms, zoom suave (modales)
animate-shimmer    — 1.5s loop, skeleton loading
```

**Importante:** todas las animaciones se desactivan automáticamente cuando el usuario tiene `prefers-reduced-motion: reduce` activo (regla global en `index.css`).

---

## Guía de uso de componentes

### Button

```tsx
// Cuándo usar cada variante:
<Button variant="primary">Guardar cambios</Button>      // acción principal de la página
<Button variant="secondary">Cancelar</Button>           // acción secundaria
<Button variant="danger">Eliminar usuario</Button>      // acción destructiva
<Button variant="ghost">Ver detalles</Button>           // acción de baja jerarquía

// Tamaños:
<Button size="sm">Filtrar</Button>    // dentro de tablas o toolbars
<Button size="md">Crear</Button>      // default, uso general
<Button size="lg">Ingresar</Button>   // CTAs de pantalla completa (login)

// Con ícono y estado de carga:
import { Plus } from 'lucide-react';
<Button leftIcon={<Plus className="h-4 w-4" />}>Agregar producto</Button>
<Button isLoading>Guardando...</Button>
```

**Regla:** no más de un `Button variant="primary"` por vista. El ojo del usuario necesita saber cuál es la acción principal.

### Alert

```tsx
<Alert variant="error">Email o contraseña incorrectos.</Alert>
<Alert variant="warning">Este cambio no se puede deshacer.</Alert>
<Alert variant="info">La sincronización se realiza cada 5 minutos.</Alert>
<Alert variant="success">Venta registrada correctamente.</Alert>
```

Las alertas llevan ícono automático según variante. No duplicar el ícono en el texto.

### Badge

```tsx
<Badge variant="success">Activo</Badge>
<Badge variant="danger">Inactivo</Badge>
<Badge variant="warning">Pendiente</Badge>
<Badge variant="info">Nuevo</Badge>
<Badge variant="default">Sin asignar</Badge>
```

Los badges son **solo informativos** — nunca deben ser clickeables. Para filtros interactivos, usar otro componente.

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Stock crítico</CardTitle>
    <CardDescription>Productos con menos de 5 unidades.</CardDescription>
  </CardHeader>
  <CardContent>
    {/* contenido */}
  </CardContent>
  <CardFooter>
    <Button variant="secondary" size="sm">Ver todos</Button>
  </CardFooter>
</Card>
```

### EmptyState

```tsx
import { Package } from 'lucide-react';

<EmptyState
  icon={<Package className="h-6 w-6" />}
  title="Sin productos aún"
  description="Agregá tu primer producto para empezar a registrar ventas."
  action={<Button leftIcon={<Plus className="h-4 w-4" />}>Agregar producto</Button>}
/>
```

### Skeleton (loading placeholder)

```tsx
// Imitar la forma del contenido que va a cargar:
<Skeleton className="h-10 w-full" />          // input placeholder
<Skeleton className="h-32 w-full" />          // card placeholder
<Skeleton className="h-4 w-48" />             // texto de una línea
```

### IconButton

```tsx
import { Trash2, Edit } from 'lucide-react';

<IconButton icon={<Edit className="h-4 w-4" />} label="Editar usuario" size="sm" />
<IconButton icon={<Trash2 className="h-4 w-4" />} label="Eliminar" variant="secondary" />
```

`label` es obligatorio: es el `aria-label` que usan lectores de pantalla. No puede estar vacío.

---

## Iconografía — Lucide React

El proyecto usa [Lucide React](https://lucide.dev). Más de 1000 íconos, consistentes en trazo y tamaño.

```tsx
import { Plus, Trash2, Edit, Package, Users, Store, ChevronDown } from 'lucide-react';
```

Tamaños estándar:
- `h-4 w-4` — dentro de botones, badges, inputs
- `h-5 w-5` — íconos standalone en texto
- `h-6 w-6` — íconos en EmptyState o headers

Siempre agregar `aria-hidden="true"` en íconos decorativos. Si el ícono es el único indicador de significado (como en `IconButton`), el texto alternativo va en `aria-label` del elemento contenedor.

---

## Accesibilidad

### Focus rings

Todos los elementos interactivos tienen `focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2`. Se usa `focus-visible` (no `focus`) para que no aparezca en clicks de mouse.

### Touch targets

Tamaño mínimo de 40px para todos los elementos clickeables en mobile:
- `Button size="sm"` → `h-8` (32px) — **excepción documentada** para toolbars densas
- `Button size="md"` → `h-10` (40px) — mínimo recomendado
- `IconButton size="sm"` → `h-8 w-8` — ídem, usar con criterio

### ARIA labels

- Modales: `aria-modal="true"`, `aria-labelledby` apuntando al `<h2>` del título
- Alertas: `role="alert"` para anuncio inmediato a screen readers
- Iconos decorativos: `aria-hidden="true"`
- Botones de ícono: `aria-label` descriptivo en español

---

## DO / DON'T

| DO | DON'T |
|----|-------|
| Usar `brand-primary` para el botón principal | Usar colores hardcodeados (`#4f46e5`) en componentes |
| Un solo `Button variant="primary"` por vista | Dos botones primarios compitiendo visualmente |
| `Alert` para feedback de sistema | Toast o notificaciones flotantes (por ahora fuera de scope) |
| `isLoading` en el botón de submit mientras el form procesa | Deshabilitar el botón y no dar ninguna retroalimentación |
| `Skeleton` mientras carga datos | Mostrar pantalla en blanco o spinner de pantalla completa |
| `animate-scale-in` en modales | Animaciones de más de 400ms |
| `aria-label` en español en todos los `IconButton` | `aria-label="X"` o dejarlo vacío |
| `size="lg"` para CTAs en pantalla de login | `size="lg"` en todos los botones |
