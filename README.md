# NexoDocs API

Backend REST del MVP de NexoDocs, una plataforma para gestionar clientes, procesos y solicitudes documentales.

Este repositorio contiene solo la API. El frontend vive en el repositorio `nexodocs-web`.

## Stack

- NestJS 11
- TypeScript
- Prisma 7
- PostgreSQL
- JWT con cookies HTTP-only
- Argon2
- pnpm

## Modulos principales

- Auth: registro, login, refresh token, logout y usuario actual.
- Organizations: organizacion activa del usuario.
- Clients: clientes y contactos.
- Workspaces: procesos por cliente.
- Checklist templates: plantillas documentales.
- Document requests: solicitudes de documentos.
- Documents: carga real en Supabase Storage, descargas firmadas y estados documentales.
- Reviews: aprobaciones, rechazos y observaciones.
- Deliveries: entregas y aprobaciones.
- Activity logs: trazabilidad basica.
- Plans: planes, limites y uso.

## Requisitos

- Node.js 22 LTS.
- pnpm 11.
- PostgreSQL.

## Variables de entorno

Copia el ejemplo:

```bash
cp .env.example .env
```

Variables obligatorias:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
WEB_ORIGIN=http://localhost:3000
WEB_ORIGINS=http://localhost:3000
JWT_ACCESS_SECRET=replace_with_strong_access_secret
JWT_REFRESH_SECRET=replace_with_strong_refresh_secret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_DAYS=30
COOKIE_SECURE=false
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_with_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=nexodocs-documents
```

Variables de produccion:

```bash
PORT=10000
NODE_ENV=production
COOKIE_SECURE=true
WEB_ORIGIN=https://your-nexodocs-web.vercel.app
WEB_ORIGINS=https://your-nexodocs-web.vercel.app
```

Notas:

- `WEB_ORIGINS` acepta multiples URLs separadas por coma.
- `COOKIE_SECURE=true` debe usarse en HTTPS.
- Redis no se usa en el MVP actual.
- Supabase Storage debe estar configurado para subir y descargar archivos reales.

## Desarrollo local

Instalar dependencias:

```bash
pnpm install
```

Generar Prisma Client:

```bash
pnpm prisma:generate
```

Ejecutar migraciones:

```bash
pnpm prisma:migrate
```

Cargar seed:

```bash
pnpm prisma:seed
```

Levantar API:

```bash
pnpm start:dev
```

URL local:

```text
http://localhost:3001
```

Health check:

```text
GET /health
```

## Scripts

```bash
pnpm build             # prisma generate + build NestJS
pnpm start             # iniciar NestJS
pnpm start:dev         # watch mode
pnpm start:prod        # iniciar dist/src/main.js
pnpm prisma:generate   # generar Prisma Client
pnpm prisma:migrate    # ejecutar migraciones dev
pnpm prisma:seed       # cargar datos base
pnpm test              # tests unitarios
pnpm test:e2e          # tests e2e
```

## Deploy en Render

Configuracion recomendada:

- Runtime: Node
- Node.js: 22 LTS
- Build command:

```bash
pnpm install --frozen-lockfile && pnpm deploy:build
```

- Start command:

```bash
pnpm start:prod
```

Variables en Render:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
WEB_ORIGIN=https://your-nexodocs-web.vercel.app
WEB_ORIGINS=https://your-nexodocs-web.vercel.app
JWT_ACCESS_SECRET=replace_with_strong_access_secret
JWT_REFRESH_SECRET=replace_with_strong_refresh_secret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_DAYS=30
COOKIE_SECURE=true
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_with_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=nexodocs-documents
```

Render define `PORT` automaticamente. La API escucha `PORT`, luego `API_PORT`, y finalmente `3001`.

`pnpm deploy:build` ejecuta `prisma migrate deploy` antes del build. Asi Render aplica las migraciones pendientes en Supabase antes de arrancar la nueva API.

## Base de datos

La base recomendada para el MVP desplegado es Supabase Postgres.

Despues de crear la base, ejecuta migraciones y seed apuntando a la URL real:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public" pnpm prisma:deploy
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public" pnpm prisma:seed
```

## Supabase Storage

Crear un bucket privado antes de probar cargas reales:

```text
nexodocs-documents
```

La API sube archivos con la service role key y guarda metadata en `FileAsset`. Los usuarios no reciben URLs publicas permanentes; la API genera URLs firmadas de corta duracion para descarga.

Rutas principales:

```text
POST /document-requests/:id/upload
GET /documents/:id/download
POST /deliveries/:id/items/upload
GET /deliveries/items/:itemId/download
```

## Estado del MVP

El flujo documental ya puede guardar binarios reales en Supabase Storage. Los endpoints `mock-upload` y `items` siguen existiendo para compatibilidad/demo, pero la web usa los endpoints reales de upload.
