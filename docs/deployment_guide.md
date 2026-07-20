# Guía de Despliegue Producción: Surmoda Inventory

Esta guía detalla paso a paso cómo desplegar el sistema usando la infraestructura elegida: **Railway** (Backend), **Cloudflare Pages** (Frontend), **Neon** (Base de Datos) y **Cloudflare R2** (Almacenamiento de imágenes).

---

## 1. Base de Datos (Neon)

Neon provee Postgres serverless con un Free Tier muy generoso.

1. Creá una cuenta en [Neon.tech](https://neon.tech) (podés usar tu GitHub).
2. Creá un nuevo proyecto. Llamalo `surmoda-inventory`.
3. Seleccioná la región más cercana a Bolivia (usualmente us-east-1 o us-east-2, Virginia/Ohio).
4. En el dashboard del proyecto recién creado, andá a la sección **Connection Details**.
5. Copiá el `Connection string` (asegurate de que tenga el password incluido y empiece con `postgresql://`).
6. **Guardá este connection string**; lo usaremos en Railway como `DATABASE_URL`.

---

## 2. Almacenamiento de Imágenes (Cloudflare R2)

R2 es el object storage de Cloudflare, compatible con S3 pero sin costos de salida (egress fees).

1. Ingresá al dashboard de [Cloudflare](https://dash.cloudflare.com/) y andá a **R2 Object Storage**.
2. Hacé clic en **Create bucket**. Llamalo `surmoda-images` (o el nombre que prefieras).
3. Entrá al bucket recién creado, andá a **Settings** > **Public Access** > **Custom Domains** y conectá tu dominio o habilitá un subdominio dev (e.g., `https://pub-xxxxxx.r2.dev`).
   - _Nota: Esa URL pública será tu `S3_PUBLIC_URL_PREFIX`._
4. Volvé al menú principal de R2 (afuera del bucket) y hacé clic en **Manage R2 API Tokens** en la barra lateral derecha.
5. Hacé clic en **Create API token**.
   - Permisos: `Object Read & Write` (asegurate de limitarlo SOLO al bucket `surmoda-images` por seguridad).
6. Al crearlo, Cloudflare te mostrará 3 datos clave:
   - **Access Key ID** (`S3_ACCESS_KEY_ID`)
   - **Secret Access Key** (`S3_SECRET_ACCESS_KEY`)
   - **Endpoint de S3** (`S3_ENDPOINT` - normalmente es `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
7. **Guardá estos datos inmediatamente** (el secret no se vuelve a mostrar).
8. La región para R2 (`S3_REGION`) podés dejarla como `auto`.

---

## 3. Backend (Railway)

1. Ingresá a [Railway.app](https://railway.app) y logueate con GitHub.
2. Hacé clic en **New Project** > **Deploy from GitHub repo**.
3. Seleccioná el repositorio `Thompson154/surmoda_inventory`.
4. Railway detectará automáticamente el monorepo pero necesitamos guiarlo a la API.
5. Andá a los **Settings** del servicio recién creado en Railway:
   - En **Build**:
     - Builder: Nixpacks
     - Build Command: `npm run build`
   - En **Deploy**:
     - Start Command: `npm run start -w @proyecto-degrado/api`
6. Andá a la pestaña **Variables** y agregá:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<pegar_el_connection_string_de_Neon>
   JWT_SECRET=<generar_un_string_aleatorio_seguro_de_32_caracteres>
   COOKIE_DOMAIN=<tu_dominio.com> o dejalo vacío si aún no tenés
   FE_ORIGIN=https://<la_url_que_te_de_cloudflare_pages>
   IMAGE_STORAGE=s3
   S3_ENDPOINT=<endpoint_de_cloudflare_r2>
   S3_REGION=auto
   S3_ACCESS_KEY_ID=<access_key>
   S3_SECRET_ACCESS_KEY=<secret_key>
   S3_BUCKET_NAME=surmoda-images
   S3_PUBLIC_URL_PREFIX=<url_publica_del_bucket_r2>
   ENABLE_DAILY_SALES_LOCK=true
   ```
7. Para migrar la base de datos en Neon, andá a la pestaña **Deployments** en Railway, abrí el CLI (Terminal) del contenedor o ejecutá un comando ad-hoc:
   ```bash
   npm run prisma:deploy -w @proyecto-degrado/api
   npm run prisma:seed -w @proyecto-degrado/api
   ```
8. En la pestaña **Settings** > **Networking**, hacé clic en **Generate Domain**. Esta URL (e.g., `surmoda-api.up.railway.app`) será el `VITE_API_BASE_URL` de tu frontend.

---

## 4. Frontend (Cloudflare Pages)

1. En el dashboard de [Cloudflare](https://dash.cloudflare.com/), andá a **Workers & Pages**.
2. Hacé clic en **Create application** > pestaña **Pages** > **Connect to Git**.
3. Seleccioná el repo `Thompson154/surmoda_inventory`.
4. En la configuración de build (Set up builds and deployments):
   - **Framework preset**: Vite
   - **Build command**: `npm run build -w @proyecto-degrado/web`
   - **Build output directory**: `apps/web/dist`
   - **Root directory**: `/` (dejalo en root para que el npm workspaces funcione bien)
5. En la sección **Environment variables (advanced)**, agregá:
   - `VITE_API_BASE_URL`: `https://<url_generada_en_railway>/api/v1`
6. Hacé clic en **Save and Deploy**.

### Configuración del Dominio Personalizado

1. Una vez desplegado el frontend, andá a la pestaña **Custom Domains** dentro del proyecto en Cloudflare Pages.
2. Hacé clic en **Set up a custom domain** y escribí tu dominio (ej. `surmoda.com.bo`).
3. Cloudflare gestionará automáticamente los registros DNS y generará el certificado SSL/TLS de forma gratuita.

---

**¡Listo!** Con esto tenés tu PWA corriendo en el edge global de Cloudflare, tu backend en Railway, tu DB serverless en Neon, y las imágenes persistidas de forma económica en R2.
