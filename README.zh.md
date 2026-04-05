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

应用将在 `http://localhost:3000` 运行。首次启动时会自动创建默认管理员账号，密码为**随机生成**并打印到容器日志中：

```
docker compose logs app | grep -A4 "Default admin"
```

| 字段 | 值 |
|---|---|
| 邮箱 | `admin@example.com` |
| 密码 | *（随机生成，见启动日志）* |

> 首次登录后请及时修改密码。

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
| `SECURE_COOKIES` | | `false` | 通过 HTTPS（TLS 终止代理）提供服务时设为 `true` |

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

### 通过 GitLab CI

将本仓库的 `.gitlab-ci-template.yml` 复制到你的服务仓库并命名为 `.gitlab-ci.yml`，然后配置 CI/CD 变量：

- **Variable** `SPECULO_URL` — 你的 Speculo 实例地址
- **Masked secret** `SPECULO_TOKEN` — write 权限 MCP Token

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

## 团队管理

团队是权限边界：每个服务归属于一个团队，用户也归属于团队。超级管理员管理所有团队；团队所有者管理本团队的成员、服务和授权。

### 角色说明

| 角色 | 范围 | 权限 |
|---|---|---|
| `super_admin` | 全局 | 管理所有团队、用户、服务 |
| `team_owner` | 团队 | 管理成员、服务、跨团队授权 |
| `team_member` | 团队 | 访问团队所拥有的所有服务 |
| `guest` | 显式授权 | 仅访问被明确授权的服务 |

### 跨团队授权

团队所有者可以向另一个团队（或特定用户）授予本团队某个服务的访问权限，支持限定特定分支和设置过期时间。在 `/admin/teams/:id/grants` 页面管理授权。

## 测试

### 单元 / 集成测试（API）

```bash
cd packages/api && pnpm test
```

### E2E 测试（Playwright）

```bash
cp packages/e2e/.env.e2e.example packages/e2e/.env.e2e
# 填写 BASE_URL 和 ADMIN_PASSWORD
cd packages/e2e && pnpm test
```

E2E 测试覆盖登录、规范上传、目录浏览、MCP Token 管理和管理员用户操作。CI 工作流（`.github/workflows/e2e.yml`）会在每次推送时自动运行。

## API 参考

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `POST` | `/auth/register` | JWT (super_admin) | 创建账号 |
| `POST` | `/auth/login` | — | 获取 JWT |
| `POST` | `/auth/logout` | — | 清除会话 Cookie |
| `GET` | `/api/me` | JWT | 当前用户信息及所属团队 |
| `GET` | `/api/tokens` | JWT | 列出 MCP Token |
| `POST` | `/api/tokens` | JWT | 创建 MCP Token |
| `DELETE` | `/api/tokens/:id` | JWT | 吊销 MCP Token |
| `POST` | `/api/upload` | JWT 或 write MCP Token | 上传规范 |
| `GET` | `/api/catalog` | JWT | 列出所有服务（含团队信息） |
| `GET` | `/api/search?q=` | JWT | 全文搜索端点（tsvector） |
| `GET` | `/api/specs/:service/:branch/openapi.json` | JWT | 原始规范 JSON |
| `GET` | `/docs/:service/:branch` | JWT cookie | Scalar 文档 UI |
| `GET` | `/docs/:service/:branch/llms.txt` | JWT (Bearer/cookie) 或 read MCP Token | LLM 可读摘要 |
| `POST` | `/mcp` | read MCP Token | MCP JSON-RPC |
| `GET` | `/mcp` | read MCP Token | MCP SSE 流 |
| `GET` | `/health` | — | 健康检查（供 CI / 负载均衡使用） |
| `GET` | `/api/admin/teams` | JWT (super_admin) | 列出团队 |
| `POST` | `/api/admin/teams` | JWT (super_admin) | 创建团队 |
| `GET` | `/api/admin/teams/:id/members` | JWT (owner+) | 列出成员 |
| `POST` | `/api/admin/teams/:id/members` | JWT (owner+) | 添加成员 |
| `GET` | `/api/admin/teams/:id/services` | JWT (owner+) | 列出团队服务 |
| `GET` | `/api/admin/teams/:id/grants` | JWT (owner+) | 列出授权 |
| `POST` | `/api/admin/teams/:id/grants` | JWT (owner+) | 创建授权 |
| `DELETE` | `/api/admin/grants/:id` | JWT (owner+) | 撤销授权 |
| `GET` | `/api/admin/users` | JWT (super_admin) | 列出用户 |
| `PUT` | `/api/admin/users/:id` | JWT (super_admin) | 更新用户角色/状态 |
| `DELETE` | `/api/admin/users/:id` | JWT (super_admin) | 删除用户 |

## 技术栈

- **后端：** Node.js 22、TypeScript、[Hono](https://hono.dev)、Drizzle ORM、PostgreSQL 16
- **前端：** React 19、Vite、Tailwind CSS、React Router v6
- **文档渲染：** [@scalar/api-reference](https://github.com/scalar/scalar)
- **规范处理：** `@scalar/openapi-upgrader`、`@stoplight/spectral-core`、`@apidevtools/swagger-parser`
- **MCP：** `@modelcontextprotocol/sdk`

## 开源许可

Apache 2.0
