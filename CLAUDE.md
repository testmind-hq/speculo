# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Notes

- `docs/superpowers/` is gitignored — specs, plans, and brainstorm files live there locally but are never committed.

## What is Speculo

Self-hosted internal API documentation platform. Teams upload OpenAPI specs; Speculo stores them in PostgreSQL, renders them via Scalar, and exposes them to AI assistants via MCP (Model Context Protocol).

## Commands

All commands run from the repo root unless noted.

```bash
# Install dependencies
pnpm install

# Dev (runs api + web in parallel)
pnpm dev

# Run api tests only
cd packages/api && pnpm test

# Run a single test file
cd packages/api && pnpm test src/routes/auth.test.ts

# Watch mode
cd packages/api && pnpm test:watch

# TypeScript check (run in each package separately)
cd packages/api && pnpm tsc --noEmit
cd packages/web && pnpm tsc --noEmit

# Build api
cd packages/api && pnpm build

# Generate DB migrations after schema changes
cd packages/api && pnpm db:generate

# Apply migrations
cd packages/api && pnpm db:migrate

# Docker (full stack)
docker compose up
```

## Required Environment Variables

`packages/api` requires these at startup (validated by Zod in `src/env.ts`, will throw on missing):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | postgres connection string |
| `JWT_SECRET` | min 32 chars |
| `JWT_EXPIRY_DAYS` | default 7 |
| `PORT` | default 3000 |

Tests bypass this via `packages/api/vitest.setup.ts` which sets fake values before module load.

## Architecture

### Monorepo layout

```
packages/api/   — Hono backend (Node 22, TypeScript ESM)
packages/web/   — React 19 SPA (Vite, Tailwind, React Router v6)
docker-compose.yml
.github/workflows/speculo-sync.yml   — template for other repos to auto-push specs
```

### API package structure (`packages/api/src/`)

- **`server.ts`** — Hono entry point, mounts all routers
- **`env.ts`** — Zod-validated env vars, imported by everything
- **`db/schema.ts`** — All Drizzle table definitions
- **`db/index.ts`** — pg Pool + Drizzle client
- **`middleware/jwtAuth.ts`** — JWT verification → sets `c.get('userId')`
- **`middleware/uploadAuth.ts`** — Accepts either JWT or write-scope MCP token for upload
- **`routes/`** — One file per route group (auth, upload, catalog, search, specs, docs, llms)
- **`services/specProcessor.ts`** — Parses YAML/JSON, upgrades to OpenAPI 3.1 via `@scalar/openapi-upgrader`, runs Spectral lint (warn-only, never blocks)
- **`services/deref.ts`** — `derefSpec()` expands `$ref`s via SwaggerParser; `getDerefedSpec()` fetches from DB then caches
- **`services/cache.ts`** — LRU cache (max 50), key `"service:branch"` → dereferenced spec object
- **`services/indexBuilder.ts`** — Extracts endpoint rows from a parsed spec for `endpoint_index` table
- **`mcp/server.ts`** — `McpServer` instance with all 5 tool registrations
- **`mcp/transport.ts`** — Hono routes for `POST /mcp` and `GET /mcp` (SSE), MCP token auth

### Database tables

| Table | Purpose |
|---|---|
| `users` | email + bcrypt password, `super_admin` / `guest` role |
| `services` | one row per service name (e.g. `user-service`) |
| `spec_versions` | spec content (TEXT), branch, `is_latest` flag; no unique constraint — managed via transaction |
| `endpoint_index` | flat denormalized rows for search (`ILIKE`), FK to spec_version with cascade delete |
| `mcp_tokens` | bcrypt-hashed token, 24-char prefix for lookup, `read` / `write` scope |

### Authentication flow

- **Web users**: POST `/auth/login` → JWT (HS256, 7-day) stored in `localStorage`; all `/api/*` routes use `jwtAuth` middleware
- **MCP clients**: `read`-scope token required at `/mcp`
- **CI/CD upload**: `write`-scope token accepted by `uploadAuth` middleware (or JWT)
- **MCP token format**: `speculo_mcp_<32-char base64url>`, prefix is first 24 chars (used for DB lookup before bcrypt compare)

### Upload flow

`POST /api/upload` accepts multipart/form-data (with `file`, `service`, `branch`) or JSON (`specContent`, `service`, `branch`, `commitSha`). Inside a single DB transaction: upsert service → unset previous `isLatest` → insert new spec_version → delete old endpoint_index rows → insert new endpoint_index rows. Cache is invalidated after the transaction commits.

### MCP tools (5)

Registered in `mcp/server.ts`, implemented in `mcp/tools/`:
- `list_services` — services + branches from DB
- `search_endpoints` — ILIKE search on `endpoint_index`, optional `branch` filter
- `get_endpoint_detail` — dereferenced spec lookup for one endpoint's full detail
- `get_schema_detail` — pulls a named schema from `components.schemas`
- `get_service_markdown` — full service spec rendered as Markdown via `@scalar/openapi-to-markdown`

### Web package (`packages/web/src/`)

- **`lib/api.ts`** — typed fetch client; reads JWT from `localStorage` as `speculo_token`
- **`App.tsx`** — React Router v6 with `PrivateLayout` guard (redirects to `/login` if no token)
- Pages: `Login`, `Catalog` (service list), `Import` (drag-drop spec upload), `Tokens` (MCP token management)
- Vite proxies `/api/*` and `/auth/*` to `localhost:3000` in dev (configured in `vite.config.ts`)

### Testing notes

- Tests run in-process with `vi.mock` for DB and middleware — no real database required
- `vitest.setup.ts` sets `process.env.DATABASE_URL` and `process.env.JWT_SECRET` before module load to satisfy Zod validation
- `bcrypt` is mocked in transport tests (`vi.mock('bcrypt', ...)`) because the native addon isn't available in the test environment
- `@stoplight/spectral-core` is accessed as `spectralCoreModule as unknown as {...}` because its type exports differ from the runtime shape

### Migrations

Drizzle migrations live in `packages/api/src/db/migrations/`. After changing `schema.ts`, run `pnpm db:generate` to produce a new SQL migration file, then `pnpm db:migrate` to apply it. Current migrations: `0000_gigantic_bullseye.sql` (initial schema), `0001_exotic_pyro.sql` (prefix column widened to 24 chars).

## E2E Testing (`packages/e2e/`)

### Commands

```bash
# Run all e2e tests (requires server running or BASE_URL set)
cd packages/e2e && pnpm test

# Interactive UI mode
cd packages/e2e && pnpm test:ui

# Against a remote server
BASE_URL=http://10.0.0.5:3000 cd packages/e2e && pnpm test
```

Copy `.env.e2e.example` to `.env.e2e` and fill in credentials before running locally.

### Selector stability rules

Prefer selectors in this order — use the most stable one available:

1. **`data-testid`** — best; immune to translation, style, and structure changes
2. **`aria-label`** / ARIA role + accessible name — good for interactive elements
3. **Role-based** (`getByRole('button', { name: /text/i })`) — acceptable
4. **`getByText`** — only for assertions, not for finding interactive elements
5. **CSS classes / placeholder text** — avoid; breaks when styles or i18n change

### `data-testid` conventions

- Add `data-testid` to any element that e2e tests need to find and that has no stable ARIA role + name
- Use kebab-case names that describe the element's purpose: `token-name-input`, `upload-success-alert`
- Keep names stable — renaming a testid breaks tests just like renaming a CSS class would
- When adding a new UI element that tests will target, add the `data-testid` in the same PR as the test

### Maintenance workflow

- **UI change**: If an element's text, class, or structure changes, check `packages/e2e/tests/` for selectors that target it. Update any CSS/text-based selectors; `data-testid` selectors need no update unless the element itself is removed or repurposed.
- **New feature**: Write the test spec first (or alongside the feature). Add `data-testid` to any elements the test needs.
- **Failing test in CI**: Run `pnpm test:ui` locally with `BASE_URL` pointing at the dev server to debug interactively.
