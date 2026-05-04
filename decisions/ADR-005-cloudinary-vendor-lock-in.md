# ADR-005 — Cloudinary como image storage (vendor lock-in aceptado)

- **Estado**: Aceptado
- **Fecha**: 2026-05-01
- **Autores**: Adrian Thompson
- **Versión constitución**: v1.0.1

## Contexto

La constitución § 2.3 fija **Cloudinary** como servicio de almacenamiento y optimización de imágenes para todos los productos del sistema. El acoplamiento concreto:

- API keys de Cloudinary en variables de entorno (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- URLs públicas de Cloudinary almacenadas en columnas `image_url` de la DB (`Product`, `ProductVariant`)
- Transformaciones (resize, formato webp) computadas vía URL params de Cloudinary, no en código propio

Migrar el sistema a otro proveedor implicaría: (1) re-uploadear N imágenes existentes; (2) actualizar todas las `image_url` en DB; (3) reescribir la lógica de transformación de URLs.

El audit del 2026-05-01 marcó esto como riesgo de vendor lock-in concreto y pidió decisión documentada: ¿se acepta, se mitiga, o se mueve a S3?

## Decisión

**Mantener Cloudinary** como única dependencia de almacenamiento de imágenes en producción. Mitigar el lock-in mediante:

1. Toggle `IMAGE_STORAGE` (env var) que ya existe y permite usar disco local en desarrollo (fallback testeado)
2. Una capa de abstracción mínima en `apps/api/src/infrastructure/cloudinary.ts` que expone `uploadImage(buffer)` y `deleteImage(publicId)` — el resto del código no importa el SDK directamente

## Alternativas consideradas

### Opción A — S3 + CDN propio (CloudFront / Bunny CDN)

Más control sobre el bucket, pricing predecible a escala. **Descartada**: requiere setup de IAM, bucket policies, CORS, lifecycle rules, CDN distribution. Para una boutique con ~500 imágenes (~2GB total), Cloudinary free tier alcanza sobrado y elimina toda la operación de infra de imágenes. El "control" de S3 es un beneficio cuando hay >50GB o requisitos compliance específicos — no es nuestro caso.

### Opción B — Self-hosted MinIO

Compatible con S3 API, autoalojado. **Descartada**: agrega un servicio más al deploy (otro container, otro volumen persistente, otro punto de falla, otro CDN para servir imágenes públicas). Overkill flagrant para 1 boutique.

### Opción C — UploadThing / similares (Bunny.net Storage, Tigris)

Servicios SaaS competidores de Cloudinary. **Descartada**: igual lock-in que Cloudinary, con ecosystem más chico, pricing menos transparente, y los devs los conocen menos. Si vamos a aceptar lock-in, mejor el más maduro.

### Opción D — Cloudinary (lo elegido)

Free tier generoso (25 créditos/mes ≈ 25GB storage o bandwidth o transformaciones), API REST + SDKs maduros, transformaciones URL-based (no requiere processing en backend), CDN global incluido. El lock-in es real pero acotado: las imágenes son el único asset migrable, y la migración es mecánica.

## Consecuencias

### Positivas

- Free tier cubre el caso por completo (~500 imágenes × ~500KB c/u = ~250MB de los 25GB)
- Transformaciones (resize, webp, q_auto) sin código propio — solo URL params
- CDN global incluido — imágenes rápidas en cualquier parte del país
- SDK TypeScript first-class, manejo de errores predecible
- El código de upload está aislado en `infrastructure/cloudinary.ts` — el resto del API no sabe que existe Cloudinary

### Negativas / aceptadas

- **Vendor lock-in real**: si Cloudinary sube precios, cierra free tier, o cambia política, hay costo de migración
- **Tracking implícito**: Cloudinary registra uso en sus servidores (no es un problema para una boutique pero sí en otros contextos)
- Las URLs de imágenes son públicas por default — sin protección por token (aceptable para un catálogo de productos visible al público)

### Acciones de seguimiento

- **Documentar en `docs/setup.md`** cómo rotar las credenciales de Cloudinary (en caso de leak o migración)
- Si en el futuro se llega a >5 sucursales o >5000 productos, reevaluar costo Cloudinary vs S3 + CloudFront/Bunny CDN
- Mantener el toggle `IMAGE_STORAGE=local` funcional para tests E2E sin internet
- No usar features avanzadas de Cloudinary (face detection, AI tagging) que profundicen el lock-in sin beneficio claro

## Evidencia Flipped Interaction (tesis)

**Pregunta de la IA**: "El stack tiene Cloudinary fijado. ¿Sabés que esto crea lock-in concreto? Las URLs van a estar en la DB. Migrar después es trabajo. ¿Querés evaluar S3 ahora o aceptar el lock-in?"

**Alternativas presentadas**: (A) S3 + CDN propio, (B) MinIO self-hosted, (C) competidores SaaS de Cloudinary, (D) Cloudinary actual.

**Elección humana**: Opción D. Razón textual: "para una boutique en Bolivia con 500 productos, S3 es ingeniería para empresas grandes. Acepto el lock-in. Si crece, migramos."

**Cómo Flipped evitó error**: la IA podría haber implementado Cloudinary "porque está en la constitución" sin marcar el lock-in. La pregunta convirtió una decisión que parecía "ya está decidida" en una decisión consciente con trade-offs explícitos. Documentar el toggle `IMAGE_STORAGE` y la capa `cloudinary.ts` como única superficie de contacto deja la puerta abierta para migración futura sin sorpresas.
