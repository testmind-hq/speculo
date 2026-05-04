# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `NOTICE` file documenting open-source dependencies and their licenses
- Acknowledgements section in `README.md` and `README.zh.md`

### Changed
- `LICENSE` file replaced with verbatim canonical Apache-2.0 SPDX template (no behavior change; ensures GitHub License detection identifies the project as `Apache-2.0` instead of `Other`)
- GitHub repository description and topics populated for discoverability

## [0.4.0] - 2026-04-05

### Added
- **UI redesign** with shadcn/ui component system and 210px dark sidebar layout
- Custom `ThemeProvider` for dark/light toggle, persisted to `localStorage` (replaces `next-themes`)
- All pages rebuilt with shadcn/ui (Catalog, Import, Diff, Tokens, Login, plus admin pages: Teams, Users, TeamMembers, TeamServices, TeamGrants, AuditLogs, Webhooks)
- Role-filtered sidebar navigation with Lucide icons; user role derived from `api.me()` (not `localStorage`)
- Deterministic service color assignment (`src/lib/serviceColors.ts`)

- **Internationalization** — `react-i18next` + `i18next` bilingual support (English default, Simplified Chinese)
- ~240 UI strings extracted into `src/locales/en.json` and `src/locales/zh.json`
- Language toggle in the sidebar user-footer dropdown
- `speculo_lang` localStorage persistence

- **Playwright E2E test suite** — `packages/e2e/` with 24 tests across 6 spec files (auth, catalog, import, Scalar viewer, MCP tokens, admin flows)
- `GET /health` endpoint for CI readiness probing
- `.github/workflows/e2e.yml` — runs on push to main, PRs, and daily at 02:00 UTC
- `data-testid` attributes on fragile UI elements (`Import.tsx`, `Tokens.tsx`); selector conventions documented
- E2E test scenarios documented in `docs/e2e/`

- **Create User UI** — admin can create users from `/admin/users` via dialog (was API-only)
- **`ADMIN_PASSWORD` env var** — optional override for the random-generated initial admin password (useful for E2E / CI)

### Changed
- License switched from MIT to Apache 2.0
- `README.md` and `README.zh.md` synced; ZH version brought up to parity with EN (Team Management, GitLab CI, Testing sections, all admin endpoints)

### Fixed
- **Security: upload role restriction** — any authenticated JWT could previously upload specs for any service; now requires `team_owner` or `super_admin` role (write-scope MCP tokens for CI/CD unaffected)
- **Permission hardening** — `permissions.ts` introduced with `getAccessibleServiceIds` + `canAccessService` helpers; `specs.ts` (403), `docs.ts` (302→/catalog), `search.ts` (scoped results), `diff.ts` (403) all gated by team-based access checks
- MCP token validation returns `{userId, userRole}` + checks `isActive`; per-session permission closures in `createMcpServer`; all 5 MCP tools enforce access

## [0.3.0] - 2026-04-04

### Added
- **Audit Logs** — all significant actions (spec upload/update, service delete, grant create/revoke, token create/revoke, user disable, team create, login) recorded to `audit_logs` table
- Super-admin-only `GET /api/admin/audit-logs` API with filtering and pagination
- Frontend AuditLogs page with filter bar and pagination

- **Spec Version History + Diff** — upload transactions retain the last 5 spec versions per service+branch
- `GET /api/specs/:service/versions` lists retained versions
- `GET /api/diff?from=<id>&to=<id>` compares two versions at endpoint level (added/removed/modified)
- Frontend Diff viewer supports cross-branch and within-branch historical comparison

- **Webhook Notifications** — abstract `WebhookProvider` interface with Feishu adapter
- `webhook_configs` table; CRUD UI; subscribe to events (`spec_uploaded`, `spec_updated`, `service_deleted`)

## [0.2.0] - 2026-03-20

### Added
- **Team management** — full CRUD for teams, members (add/remove/role-change), and cross-team grants with branch filters and expiry
- **RBAC** — `super_admin` / `team_owner` / `team_member` / `guest` roles enforced on all admin routes
- `canAccessBranch()` permission service — team membership → team grants → user grants with branch filter support
- **Full-text search** — tsvector GIN index + trigger + `websearch_to_tsquery` on spec content
- **Spec deduplication** — SHA-256 hash comparison; skips write and returns `unchanged: true` when spec is identical
- **Partial unique index** — `UNIQUE (service_id, branch) WHERE is_latest = true` prevents concurrent duplicate latest rows
- **GitLab CI** — `.gitlab-ci-template.yml` for auto-pushing specs from GitLab pipelines

### Changed
- **`llms.txt` auth** — now requires JWT (Bearer or httpOnly cookie) or read-scope MCP token; previously open

## [0.1.0] - 2026-03-15

### Added
- **MVP** — self-hosted internal API documentation platform
- **Auth** — JWT login (admin-gated registration), httpOnly session cookie, MCP token CRUD
- **OpenAPI upload & indexing** — multipart or JSON body, content-aware YAML/JSON detection, Spectral linting (warn-only), OpenAPI 3.x upgrade, atomic DB transaction
- **Catalog & search** — list services/branches, basic endpoint search
- **Interactive docs** — Scalar UI at `/docs/:service/:branch`, cookie auth with redirect to login
- **LLM summary** — machine-readable endpoint summaries at `/docs/:service/:branch/llms.txt`
- **MCP server** — 5 tools (`list_services`, `search_endpoints`, `get_endpoint_detail`, `get_schema_detail`, `get_service_markdown`) over Streamable HTTP transport
- **Self-documenting** — Hono OpenAPI registration, served at `/docs/speculo/main`
- Two-container deployment (app + PostgreSQL) via `docker-compose.yml`
- MIT license (later switched to Apache 2.0 in 0.4.0)
