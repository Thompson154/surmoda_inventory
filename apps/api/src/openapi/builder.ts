// OpenAPI spec builder using @asteasolutions/zod-to-openapi v7 (Zod 3 compatible).
// Registers the major request/response schemas and produces an OpenAPIObject.

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// WHY: must run once before any schema is defined for .openapi() to attach
extendZodWithOpenApi(z);

import { LoginSchema } from '../modules/auth/validators';
import { CreateSaleSchema, ListSalesQuerySchema } from '../modules/sales/validators';
import { AdjustQuantitySchema, ListInventoryQuerySchema } from '../modules/inventory/validators';
import {
  CreateReturnRequestBodySchema,
  ListAllQuerySchema as ListReturnRequestsQuerySchema,
} from '../modules/return-requests/validators';

const registry = new OpenAPIRegistry();

// ─── Auth ────────────────────────────────────────────────────────────────────

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'Iniciar sesión',
  tags: ['Auth'],
  request: { body: { content: { 'application/json': { schema: LoginSchema } } } },
  responses: {
    200: { description: 'Login exitoso — retorna accessToken en body y refreshToken en cookie.' },
    401: { description: 'Credenciales inválidas.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Renovar access token',
  tags: ['Auth'],
  responses: {
    200: { description: 'Nuevo accessToken.' },
    401: { description: 'Refresh token inválido o expirado.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Cerrar sesión',
  tags: ['Auth'],
  security: [{ bearerAuth: [] }],
  responses: { 204: { description: 'Sesión cerrada.' } },
});

// ─── Sales ───────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/stores/{storeId}/sales',
  summary: 'Crear venta',
  tags: ['Sales'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ storeId: z.string() }),
    body: { content: { 'application/json': { schema: CreateSaleSchema } } },
  },
  responses: {
    201: { description: 'Venta creada.' },
    400: { description: 'Payload inválido o descuento excede límite.' },
    409: { description: 'Clave de idempotencia duplicada.' },
    423: { description: 'Ventas bloqueadas en esta sede.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/stores/{storeId}/sales',
  summary: 'Listar ventas de una sede',
  tags: ['Sales'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ storeId: z.string() }),
    query: ListSalesQuerySchema,
  },
  responses: {
    200: { description: 'Página de ventas.' },
  },
});

// ─── Inventory ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/api/v1/stores/{storeId}/inventory',
  summary: 'Listar inventario de una sede',
  tags: ['Inventory'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ storeId: z.string() }),
    query: ListInventoryQuerySchema,
  },
  responses: { 200: { description: 'Página de inventario.' } },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/stores/{storeId}/inventory/{variantId}',
  summary: 'Ajustar stock de una variante',
  tags: ['Inventory'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ storeId: z.string(), variantId: z.string() }),
    body: { content: { 'application/json': { schema: AdjustQuantitySchema } } },
  },
  responses: {
    200: { description: 'Stock ajustado.' },
    404: { description: 'Variante no encontrada en esta sede.' },
  },
});

// ─── Return Requests ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/return-requests',
  summary: 'Crear solicitud de devolución',
  tags: ['Return Requests'],
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: CreateReturnRequestBodySchema } } },
  },
  responses: {
    201: { description: 'Solicitud creada.' },
    400: { description: 'Validación fallida.' },
    404: { description: 'Producto o tienda no encontrada.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/return-requests',
  summary: 'Listar todas las solicitudes de devolución (admin/encargada)',
  tags: ['Return Requests'],
  security: [{ bearerAuth: [] }],
  request: { query: ListReturnRequestsQuerySchema },
  responses: { 200: { description: 'Página de solicitudes.' } },
});

// ─── Health ───────────────────────────────────────────────────────────────────

registry.registerPath({
  method: 'get',
  path: '/health/live',
  summary: 'Liveness — proceso activo',
  tags: ['Health'],
  responses: {
    200: { description: 'Proceso corriendo.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/ready',
  summary: 'Readiness — base de datos alcanzable',
  tags: ['Health'],
  responses: {
    200: { description: 'DB OK.' },
    503: { description: 'DB inalcanzable.' },
  },
});

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Sur Moda — API REST',
      version: '1.0.0',
      description: 'API de gestión de inventario, ventas y devoluciones.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desarrollo local' },
      { url: 'https://api.surmoda.com', description: 'Producción' },
    ],
  });
}
