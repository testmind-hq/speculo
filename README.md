# Speculo

**[中文文档](README.zh.md)**

Self-hosted internal API documentation platform. Teams push OpenAPI specs to Speculo; it stores them, renders interactive docs via [Scalar](https://scalar.com), and exposes all APIs to AI assistants through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

## Features

- **OpenAPI catalog** — upload Swagger 2.0 or OpenAPI 3.x specs (YAML or JSON), browse them by service and branch
- **Interactive docs** — Scalar-rendered UI at `/docs/:service/:branch`
- **MCP server** — connect Claude Desktop, Cursor, or any MCP client; query your entire API catalog with natural language
- **LLM-friendly** — machine-readable endpoint summaries at `/docs/:service/:branch/llms.txt`
- **CI/CD sync** — GitHub Actions template to auto-push specs on every commit
- **Self-hosted** — two Docker containers (app + PostgreSQL), no external dependencies

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/yuchou87/speculo.git
cd speculo

# Generate a secure JWT secret
openssl rand -base64 32

# Start with the generated secret
JWT_SECRET=<paste-generated-secret> docker compose up
```

The app is available at `http://localhost:3000`. A default admin account is created automatically on first startup with a **randomly generated password** printed once to the container logs:

```
docker compose logs app | grep -A4 "Default admin"
```

| Field | Value |
|---|---|
| Email | `admin@example.com` |
| Password | *(random — see startup logs)* |

> Change the password after first login.

### Local Development

**Prerequisites:** Node.js 22+, pnpm, PostgreSQL 16

```bash
pnpm install

# Copy and fill in environment variables
cp packages/api/.env.example packages/api/.env

# Run API + web in parallel
pnpm dev
```

Environment variables for `packages/api`:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | Min 32 characters |
| `JWT_EXPIRY_DAYS` | | `7` | Token lifetime in days |
| `PORT` | | `3000` | HTTP port |
| `SECURE_COOKIES` | | `false` | Set to `true` when serving over HTTPS (behind TLS terminator) |

Apply database migrations:

```bash
cd packages/api
pnpm db:migrate
```

## Uploading a Spec

### Via the web UI

1. Open `http://localhost:3000`, sign in
2. Go to **Import** and drag-drop your `openapi.yaml` / `openapi.json`

### Via API (CI/CD)

```bash
# Using a write-scope MCP token
curl -X POST http://your-speculo/api/upload \
  -H "Authorization: Bearer speculo_mcp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "service": "user-service",
    "branch": "main",
    "commitSha": "abc123",
    "specContent": "<your openapi yaml or json string>"
  }'
```

Or with multipart form (file upload):

```bash
curl -X POST http://your-speculo/api/upload \
  -H "Authorization: Bearer speculo_mcp_..." \
  -F "service=user-service" \
  -F "branch=main" \
  -F "file=@openapi.yaml"
```

### Via GitHub Actions

Copy `.github/workflows/speculo-sync.yml` to your service repo, then set:

- **Repository variable** `SPECULO_URL` — your Speculo instance URL
- **Repository secret** `SPECULO_TOKEN` — a write-scope MCP token from the Speculo UI

The workflow triggers automatically when `openapi.yaml` (or equivalent) changes on any branch.

Optionally create a `.speculo-service` file in your repo root to override the service name (defaults to the repository name).

### Via GitLab CI

Copy `.gitlab-ci-template.yml` from this repo to your service repo as `.gitlab-ci.yml`, then set CI/CD variables:

- **Variable** `SPECULO_URL` — your Speculo instance URL
- **Masked secret** `SPECULO_TOKEN` — a write-scope MCP token

## Connecting an MCP Client

1. Sign in to Speculo and go to **MCP Tokens**
2. Create a **read**-scope token
3. Copy the generated Claude Desktop / Cursor config snippet

Example config:

```json
{
  "mcpServers": {
    "speculo": {
      "url": "http://your-speculo/mcp",
      "headers": {
        "Authorization": "Bearer speculo_mcp_..."
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|---|---|
| `list_services` | List all services and their branches |
| `search_endpoints` | Full-text search across all endpoints |
| `get_endpoint_detail` | Full dereferenced schema for one endpoint |
| `get_schema_detail` | A specific component schema |
| `get_service_markdown` | Entire service spec as Markdown |

## Team Management

Teams are the permission boundary: each service belongs to a team, and users belong to teams. Super admins manage all teams; team owners manage their own team's members, services, and grants.

### Roles

| Role | Scope | Capabilities |
|---|---|---|
| `super_admin` | Global | Manage all teams, users, services |
| `team_owner` | Team | Manage members, services, cross-team grants |
| `team_member` | Team | Access all services owned by team |
| `guest` | Explicit grants only | Access only explicitly granted services |

### Cross-Team Grants

A team owner can grant another team (or a specific user) access to one of their services, optionally scoped to specific branches and with an expiry date. Manage grants at `/admin/teams/:id/grants`.

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | JWT (super_admin) | Create account |
| `POST` | `/auth/login` | — | Get JWT |
| `POST` | `/auth/logout` | — | Clear session cookie |
| `GET` | `/api/me` | JWT | Current user info + teams |
| `GET` | `/api/tokens` | JWT | List MCP tokens |
| `POST` | `/api/tokens` | JWT | Create MCP token |
| `DELETE` | `/api/tokens/:id` | JWT | Revoke MCP token |
| `POST` | `/api/upload` | JWT or write MCP token | Upload spec |
| `GET` | `/api/catalog` | JWT | List all services (with team info) |
| `GET` | `/api/search?q=` | JWT | Full-text endpoint search (tsvector) |
| `GET` | `/api/specs/:service/:branch/openapi.json` | JWT | Raw spec JSON |
| `GET` | `/docs/:service/:branch` | JWT cookie | Scalar docs UI |
| `GET` | `/docs/:service/:branch/llms.txt` | JWT (Bearer/cookie) or read MCP token | LLM-readable summary |
| `POST` | `/mcp` | read MCP token | MCP JSON-RPC |
| `GET` | `/mcp` | read MCP token | MCP SSE stream |
| `GET` | `/api/admin/teams` | JWT (super_admin) | List teams |
| `POST` | `/api/admin/teams` | JWT (super_admin) | Create team |
| `GET` | `/api/admin/teams/:id/members` | JWT (owner+) | List members |
| `POST` | `/api/admin/teams/:id/members` | JWT (owner+) | Add member |
| `GET` | `/api/admin/teams/:id/services` | JWT (owner+) | List team services |
| `GET` | `/api/admin/teams/:id/grants` | JWT (owner+) | List grants |
| `POST` | `/api/admin/teams/:id/grants` | JWT (owner+) | Create grant |
| `DELETE` | `/api/admin/grants/:id` | JWT (owner+) | Revoke grant |
| `GET` | `/api/admin/users` | JWT (super_admin) | List users |
| `PUT` | `/api/admin/users/:id` | JWT (super_admin) | Update user role/status |
| `DELETE` | `/api/admin/users/:id` | JWT (super_admin) | Delete user |

## Tech Stack

- **Backend:** Node.js 22, TypeScript, [Hono](https://hono.dev), Drizzle ORM, PostgreSQL 16
- **Frontend:** React 19, Vite, Tailwind CSS, React Router v6
- **Docs rendering:** [@scalar/api-reference](https://github.com/scalar/scalar)
- **Spec processing:** `@scalar/openapi-upgrader`, `@stoplight/spectral-core`, `@apidevtools/swagger-parser`
- **MCP:** `@modelcontextprotocol/sdk`

## License

MIT
