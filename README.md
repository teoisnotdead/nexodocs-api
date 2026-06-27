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
- Documents: carga mock y estados documentales.
- Reviews: aprobaciones, rechazos y observaciones.
- Deliveries: entregas y aprobaciones.
- Activity logs: trazabilidad basica.
- Plans: planes, limites y uso.

## Requisitos

- Node.js 22 o superior.
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
- Supabase Storage aun no esta conectado; las variables de storage quedan reservadas para una fase futura.

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
- Node.js: 22 o superior
- Build command:

```bash
pnpm install && pnpm build
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
```

Render define `PORT` automaticamente. La API escucha `PORT`, luego `API_PORT`, y finalmente `3001`.

## Base de datos

La base recomendada para el MVP desplegado es Supabase Postgres.

Despues de crear la base, ejecuta migraciones y seed apuntando a la URL real:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public" pnpm prisma:migrate
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public" pnpm prisma:seed
```

## Estado del MVP

El flujo documental usa carga mock: se guarda metadata de archivos y versiones en PostgreSQL, pero no se guardan binarios en disco ni en storage cloud. La integracion futura recomendada es Supabase Storage o S3 compatible.
