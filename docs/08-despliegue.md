# 08 — Guía de Despliegue

---

## 1. Variables de entorno

El backend valida sus variables de entorno al inicio con un esquema Zod en `apps/api/src/infrastructure/config.ts`. Si alguna variable obligatoria falta o tiene un valor inválido, el proceso termina con un mensaje de error detallado.

| Variable | Tipo | Default | Descripción |
|----------|------|---------|-------------|
| `DATABASE_URL` | URL PostgreSQL | — (obligatoria) | Conexión a la base de datos principal. Formato: `postgresql://user:pass@host:5432/dbname` |
| `DATABASE_URL_TEST` | URL PostgreSQL | — (opcional) | Conexión a la base de datos de tests. Solo necesaria en CI. |
| `JWT_SECRET` | String | — (obligatoria) | Clave para firmar y verificar JWTs. **Mínimo 32 caracteres.** Usar un valor aleatorio de alta entropía. |
| `NODE_ENV` | `development` / `test` / `production` | `development` | Modo de ejecución. En producción activa cookies `Secure` y reduce logs. |
| `PORT` | Número entero | `3000` | Puerto de escucha del servidor HTTP. |
| `COOKIE_DOMAIN` | String | `localhost` | Dominio del refresh token cookie. En producción: el dominio real (ej. `api.surmoda.com`). |
| `FE_ORIGIN` | URL | `http://localhost:5173` | Origen del frontend. Usado para la cabecera CORS. En producción: URL del frontend desplegado. |
| `ACCESS_TOKEN_TTL_MIN` | Número entero | `15` | Duración del access token JWT en minutos. |
| `REFRESH_TOKEN_TTL_DAYS` | Número entero | `7` | Duración del refresh token en días. |
| `BCRYPT_SALT_ROUNDS` | Número (4-15) | `12` | Rondas de bcrypt para hash de contraseñas. En CI se usa `4` para velocidad; en producción: `12` o más. |
| `RATE_LIMIT_LOGIN_PER_MIN` | Número entero | `10` | Máximo de intentos de login por IP por minuto. |
| `RATE_LIMIT_REFRESH_PER_MIN` | Número entero | `30` | Máximo de requests de refresh por IP por minuto. |
| `LOG_LEVEL` | `fatal`/`error`/`warn`/`info`/`debug`/`trace`/`silent` | `info` | Nivel de logging de Pino. En producción: `warn` o `error` para reducir ruido. |

El frontend solo requiere una variable opcional:

| Variable | Descripción |
|----------|-------------|
| `VITE_API_BASE_URL` | URL base de la API. Default: `http://localhost:3000/api/v1`. En producción: URL de la API desplegada. |

---

## 2. Proceso de build

### Backend

```bash
cd apps/api
npm run build
# Genera apps/api/dist/ con el JS compilado
```

El build usa `tsconfig.build.json` (excluye archivos de test). El output es CommonJS en `dist/index.js`.

### Frontend

```bash
cd apps/web
npm run build
# Genera apps/web/dist/ con archivos estáticos (HTML + JS + CSS)
```

Vite genera un bundle optimizado con code-splitting por ruta. Los archivos incluyen hashes de contenido para cache-busting.

### Build completo (desde la raíz)

```bash
npm run build
```

---

## 3. Ejecución en producción

### Backend

```bash
# Aplicar migraciones (solo la primera vez o al actualizar)
cd apps/api
npx prisma migrate deploy

# Iniciar el servidor
node dist/index.js
```

El servidor escucha en el puerto configurado en `PORT`. El cron de limpieza de refresh tokens se inicia automáticamente al arrancar (no se necesita un cron externo).

### Frontend

Los archivos generados en `apps/web/dist/` son estáticos. Se sirven con cualquier servidor web o CDN. La única configuración necesaria es redirigir todas las rutas al `index.html` para que React Router funcione correctamente (configuración de SPA fallback).

---

## 4. Opciones de hosting recomendadas

### Backend

| Plataforma | Notas |
|------------|-------|
| **Render** | Plan gratuito disponible; soporte nativo de Node.js; fácil configuración de variables de entorno. |
| **Railway** | Despliegue desde GitHub; provisión de PostgreSQL integrada. |
| **fly.io** | Control granular; útil si se necesita la app cerca de Bolivia (región South America). |
| **VPS propio** (DigitalOcean / Linode / Hetzner) | Mayor control; requiere configuración manual de PM2 o systemd, Nginx como reverse proxy, y certificado TLS. |

### Frontend

| Plataforma | Notas |
|------------|-------|
| **Vercel** | Soporte nativo de Vite; CDN global; configuración de SPA fallback automática. |
| **Netlify** | Similar a Vercel; la regla de SPA se configura con `public/_redirects`. |
| **Cloudflare Pages** | CDN con latencia mínima; integración con Workers para lógica de edge. |

### Base de datos

| Plataforma | Notas |
|------------|-------|
| **Neon** | PostgreSQL serverless; plan gratuito generoso; compatible con Prisma. |
| **Supabase** | PostgreSQL + Storage + Auth; útil para la feature 009 (PWA). |
| **Railway** | PostgreSQL gestionado; se integra bien si el backend también está en Railway. |

---

## 5. Configuración HTTPS y cookies

En producción, el servidor debe estar detrás de HTTPS. El refresh token tiene la flag `Secure` activa cuando `NODE_ENV = production` (`cookieSecure()` en `config.ts`), lo que significa que la cookie solo se enviará en conexiones HTTPS.

Si el frontend y el backend están en dominios distintos (ej. `app.surmoda.com` y `api.surmoda.com`):

1. Configurar `COOKIE_DOMAIN=surmoda.com` (dominio padre compartido) para que la cookie de refresh sea accesible desde ambos subdominios.
2. Configurar `FE_ORIGIN=https://app.surmoda.com` en el backend para la cabecera CORS.
3. Asegurar que `SameSite=Strict` no bloquee las requests cross-subdomain en el navegador. Si hay problemas, evaluar `SameSite=Lax`.

Si frontend y backend están en el mismo dominio (ej. el frontend servido por el backend de Node), la configuración es más simple, pero esa arquitectura no está implementada en esta iteración.

---

## 6. Cron de limpieza de tokens

El job `startRefreshTokenCleanup` en `apps/api/src/index.ts` se inicia automáticamente al arrancar el servidor con `setInterval` de 24 horas. Elimina físicamente los refresh tokens con `expiresAt` anterior a 30 días.

No se necesita ningún cron externo (crontab, GitHub Actions scheduled) para esta limpieza. Si se despliega con escalado horizontal (múltiples instancias del servidor), cada instancia correrá su propia copia del cron, lo que generará duplicidad de operaciones (ambas borrarán el mismo conjunto de tokens). Esto es seguro porque la operación es idempotente. Para una solución más limpia a escala, se puede mover el cron a un worker dedicado o a una función serverless en la Feature 007.

---

## 7. Base de datos — backup

Se recomienda configurar backups automáticos diarios del cluster PostgreSQL. Las plataformas gestionadas (Neon, Supabase, Railway) proveen backups automáticos en sus planes pagos.

Para un VPS propio, el procedimiento manual es:

```bash
# Dump completo
pg_dump $DATABASE_URL -Fc -f backup_$(date +%Y%m%d).dump

# Restaurar
pg_restore -d $DATABASE_URL backup_YYYYMMDD.dump
```

La tabla `audit_logs` crece indefinidamente (append-only). Para control del tamaño, en la Feature 007 se puede implementar una política de retención (ej. comprimir o archivar registros mayores a 6 meses).

---

## 8. Checklist de producción

- [ ] `JWT_SECRET` tiene al menos 32 caracteres y es generado con un CSPRNG (ej. `openssl rand -hex 32`)
- [ ] `NODE_ENV=production`
- [ ] `BCRYPT_SALT_ROUNDS=12` (o superior)
- [ ] `DATABASE_URL` apunta a un cluster gestionado con backups habilitados
- [ ] HTTPS configurado con certificado válido
- [ ] `COOKIE_DOMAIN` y `FE_ORIGIN` configurados para el dominio real
- [ ] `LOG_LEVEL=warn` en producción
- [ ] Migraciones aplicadas con `prisma migrate deploy` (no `migrate dev`)
- [ ] Health check endpoint (`/health`) configurado en el balanceador de carga
