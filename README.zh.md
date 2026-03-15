# Speculo

**[English](README.md)**

自托管的内部 API 文档平台。团队将 OpenAPI 规范推送到 Speculo，它负责存储、通过 [Scalar](https://scalar.com) 渲染交互式文档，并通过 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 将所有 API 暴露给 AI 助手。

## 功能特性

- **OpenAPI 目录** — 上传 Swagger 2.0 或 OpenAPI 3.x 规范（YAML 或 JSON），按服务和分支浏览
- **交互式文档** — 由 Scalar 渲染，访问路径为 `/docs/:service/:branch`
- **MCP 服务器** — 连接 Claude Desktop、Cursor 或任何 MCP 客户端，用自然语言查询 API 目录
- **LLM 友好** — 机器可读的端点摘要，访问路径为 `/docs/:service/:branch/llms.txt`
- **CI/CD 同步** — 提供 GitHub Actions 模板，每次提交时自动推送规范
- **完全自托管** — 两个 Docker 容器（应用 + PostgreSQL），无外部依赖

## 快速开始

### Docker（推荐）

```bash
git clone https://github.com/yuchou87/speculo.git
cd speculo

# 生成安全的 JWT 密钥
openssl rand -base64 32

# 使用生成的密钥启动
JWT_SECRET=<粘贴生成的密钥> docker compose up
```

API 将在 `http://localhost:3000` 运行。通过 API 注册第一个账号：

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}'
```

### 本地开发

**前置条件：** Node.js 22+、pnpm、PostgreSQL 16

```bash
pnpm install

# 复制并填写环境变量
cp packages/api/.env.example packages/api/.env

# 并行启动 API + 前端
pnpm dev
```

`packages/api` 所需的环境变量：

| 变量名 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL 连接字符串 |
| `JWT_SECRET` | ✅ | — | 至少 32 个字符 |
| `JWT_EXPIRY_DAYS` | | `7` | Token 有效天数 |
| `PORT` | | `3000` | HTTP 端口 |

执行数据库迁移：

```bash
cd packages/api
pnpm db:migrate
```

## 上传规范

### 通过 Web 界面

1. 打开 `http://localhost:3000`，登录
2. 进入 **Import**，拖放 `openapi.yaml` / `openapi.json` 文件

### 通过 API（CI/CD）

```bash
# 使用 write 权限的 MCP Token
curl -X POST http://your-speculo/api/upload \
  -H "Authorization: Bearer speculo_mcp_..." \
  -H "Content-Type: application/json" \
  -d '{
    "service": "user-service",
    "branch": "main",
    "commitSha": "abc123",
    "specContent": "<你的 openapi yaml 或 json 字符串>"
  }'
```

或使用 multipart 表单（文件上传）：

```bash
curl -X POST http://your-speculo/api/upload \
  -H "Authorization: Bearer speculo_mcp_..." \
  -F "service=user-service" \
  -F "branch=main" \
  -F "file=@openapi.yaml"
```

### 通过 GitHub Actions

将 `.github/workflows/speculo-sync.yml` 复制到你的服务仓库，然后配置：

- **Repository variable** `SPECULO_URL` — 你的 Speculo 实例地址
- **Repository secret** `SPECULO_TOKEN` — 在 Speculo UI 中创建的 write 权限 MCP Token

每当任意分支上的 `openapi.yaml`（或等效文件）发生变更时，工作流会自动触发。

可选：在仓库根目录创建 `.speculo-service` 文件来自定义服务名称（默认使用仓库名）。

## 连接 MCP 客户端

1. 登录 Speculo，进入 **MCP Tokens**
2. 创建一个 **read** 权限的 Token
3. 复制生成的 Claude Desktop / Cursor 配置片段

示例配置：

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

### 可用 MCP 工具

| 工具名 | 描述 |
|---|---|
| `list_services` | 列出所有服务及其分支 |
| `search_endpoints` | 跨所有端点全文搜索 |
| `get_endpoint_detail` | 获取某个端点的完整（已解引用）Schema |
| `get_schema_detail` | 获取某个组件 Schema |
| `get_service_markdown` | 以 Markdown 格式返回整个服务规范 |

## API 参考

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `POST` | `/auth/register` | — | 注册账号 |
| `POST` | `/auth/login` | — | 获取 JWT |
| `GET` | `/api/tokens` | JWT | 列出 MCP Token |
| `POST` | `/api/tokens` | JWT | 创建 MCP Token |
| `DELETE` | `/api/tokens/:id` | JWT | 吊销 MCP Token |
| `POST` | `/api/upload` | JWT 或 write MCP Token | 上传规范 |
| `GET` | `/api/catalog` | JWT | 列出所有服务 |
| `GET` | `/api/search?q=` | JWT | 搜索端点 |
| `GET` | `/api/specs/:service/:branch/openapi.json` | JWT | 原始规范 JSON |
| `GET` | `/docs/:service/:branch` | JWT | Scalar 文档 UI |
| `GET` | `/docs/:service/:branch/llms.txt` | — | LLM 可读摘要 |
| `POST` | `/mcp` | read MCP Token | MCP JSON-RPC |
| `GET` | `/mcp` | read MCP Token | MCP SSE 流 |

## 技术栈

- **后端：** Node.js 22、TypeScript、[Hono](https://hono.dev)、Drizzle ORM、PostgreSQL 16
- **前端：** React 19、Vite、Tailwind CSS、React Router v6
- **文档渲染：** [@scalar/api-reference](https://github.com/scalar/scalar)
- **规范处理：** `@scalar/openapi-upgrader`、`@stoplight/spectral-core`、`@apidevtools/swagger-parser`
- **MCP：** `@modelcontextprotocol/sdk`

## 开源许可

MIT
