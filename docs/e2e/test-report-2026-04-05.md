# E2E Test Report — 2026-04-05

**Target:** http://10.0.0.5:3000/
**Branch tested:** main (deployed)
**Tester:** agent-browser (automated)

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| S1 Authentication | ✅ PASS | Login, invalid creds, logout all work |
| S2 Service Catalog | ✅ PASS | Stats, service cards render correctly |
| S3 Import/Upload | ⚠️ PARTIAL | API works; UI result stale after second upload in same session |
| S4 Scalar Docs Viewer | ✅ PASS | Renders at `/docs/:service/:branch` (not `/:service/:branch`) |
| S5 MCP Tokens | ✅ PASS | Create read/write, revoke, empty state all work |
| S6 Language Toggle | ✅ PASS | EN↔ZH switch, localStorage persistence work |
| S7 Admin: Teams | ✅ PASS | Create, members, services, delete all work |
| S8 Admin: Users | ✅ PASS | View, role change, deactivate/activate, delete all work |
| S8B Regular User | ✅ PASS (with 1 bug) | Login, catalog access, admin block, docs, tokens, logout work |
| S9 Audit Logs | ✅ PASS | All operations logged; filters present |
| S10 Diff | ✅ PASS | Compare branches renders correctly |

**Bugs found: 3**

---

## Bug #1 — Upload UI shows stale result after second upload in same session

**Severity:** Minor / UX
**Scenario:** S3.2
**Reproduce:**
1. Upload a file (e.g. `test-service/main` with `petstore.yaml`) — success shown
2. Without navigating away, fill new service name and set a new file
3. Click Upload again

**Observed:** The success alert from the first upload remains visible while the new upload processes. Even after the new upload completes, the result shown may still display the old endpoint count and Spectral warnings from the previous spec.

**Root cause:** React state `result` is set to `null` at the start of `handleSubmit`, but due to timing of React re-renders, the alert briefly persists and the old data can remain visible if the new upload succeeds fast.

**Expected:** After clicking Upload, the old success alert should immediately clear, and the new result (for the new service/file) should be shown.

**Fix:** Reset result immediately on form submission, or navigate away after a successful upload.

---

## Bug #2 — No role-based access control on upload endpoint

**Severity:** Medium / Security
**Scenario:** S8B.6
**Reproduce:**
1. Login as a `team_member` or `guest` user
2. Navigate to `/import`
3. Upload an OpenAPI spec for any service name

**Observed:** Upload succeeds — `team_member` can create/overwrite specs for any service, including services owned by other teams.

**Expected:** Upload should require at minimum `team_owner` or `super_admin` role. A `team_member` should not be able to upload specs.

**Fix:** Add role check in `uploadAuth` middleware or in the upload route handler — reject requests where the JWT role is below `team_owner`.

---

## Bug #3 — Feature gap: No "Create User" form in Admin Users page

**Severity:** Low / Missing Feature
**Scenario:** S8.2
**Details:** The `POST /auth/register` API endpoint exists and requires a `super_admin` JWT. However, the Admin Users page (`/admin/users`) has no form to create new users. Admins must call the API directly via `curl` or a tool.

**Fix:** Add a "Create User" button/dialog to `packages/web/src/pages/admin/Users.tsx` with email and password fields, calling `api.register(email, password)`.

---

## Detailed Results

### S1 — Authentication ✅

| Test | Result |
|------|--------|
| S1.1 Login valid credentials | ✅ Redirect to `/`, sidebar visible, admin email shown |
| S1.2 Login invalid credentials | ✅ "Invalid credentials" shown, stays on `/login` |
| S1.3 Logout | ✅ Redirect to `/login`; dropdown shows MCP Tokens, language toggle, Sign out |

### S2 — Service Catalog ✅

| Test | Result |
|------|--------|
| S2.1 Empty state | ✅ "No services yet. Import your first OpenAPI spec to get started." |
| S2.2 Service cards with data | ✅ Shows service name, team, branch count; stats bar shows totals |

### S3 — Import/Upload ⚠️

| Test | Result |
|------|--------|
| S3.1 Valid OpenAPI 3.0 YAML | ✅ "✓ Uploaded — 3 endpoints" with Spectral warnings |
| S3.2 Swagger 2.0 auto-conversion | ⚠️ API returns `wasConverted: true` correctly; UI test showed stale result from previous upload (Bug #1) |
| S3.3 Upload without file | ✅ "Please select a file" error shown |
| S3.4 Cancel | ✅ Navigates to `/` |

**Note on S3.2:** Direct API call confirms `wasConverted: true`, 1 endpoint — backend conversion works correctly.

### S4 — Scalar Docs Viewer ✅

| Test | Result |
|------|--------|
| S4.1 View docs | ✅ Renders at `/docs/test-service/main` — Petstore, v1.0.0, OAS 3.1.1, endpoint list visible |
| S4.2 Expand endpoint | ✅ Schemas, curl examples, "Test Request" buttons, response tabs all interactive |

**Note:** Route is `/docs/:service/:branch`, not `/:service/:branch`. Navigating to `/:service/:branch` renders a blank page (React Router has no matching route). Catalog links are correct.

### S5 — MCP Tokens ✅

| Test | Result |
|------|--------|
| S5.1 Create read token | ✅ One-time value shown, MCP config JSON displayed, token in table |
| S5.2 Create write token | ✅ Token created, no MCP config snippet (correct — only shown for read scope) |
| S5.3 Revoke token | ✅ Token removed from list |
| S5.4 Empty state | ✅ "No tokens yet." shown |

### S6 — Language Toggle ✅

| Test | Result |
|------|--------|
| S6.1 Switch to Chinese | ✅ All sidebar labels switch: 服务目录, 导入 Spec, 版本对比, 管理, 团队 & 用户, 审计日志 |
| S6.2 Persist across reload | ✅ Chinese still displayed after full page reload |
| S6.3 Switch back to English | ✅ All labels revert to English |

### S7 — Admin: Teams ✅

| Test | Result |
|------|--------|
| S7.1 View teams list | ✅ Default team visible; Name/Display Name/Type/Actions columns |
| S7.2 Create team | ✅ `test-team` appears in table with Members/Services/Grants/Delete actions |
| S7.3 Team members | ✅ Shows admin as Owner with joined date and Remove action |
| S7.4 Team services | ✅ Shows both services with Remove actions (super_admin can see assign buttons) |
| S7.5 Delete team | ✅ Confirmation dialog; team removed from list after confirm |

### S8 — Admin: Users ✅

| Test | Result |
|------|--------|
| S8.1 View users list | ✅ Email, Role, Teams, Status, Actions columns |
| S8.2 Create user (via API) | ✅ API works; **UI form missing** (Bug #3) |
| S8.3 Change role | ✅ Updates immediately via dropdown |
| S8.4 Deactivate user | ✅ Status → inactive, button → Activate |
| S8.5 Activate user | ✅ Status → active, button → Deactivate |
| S8.6 Delete user | ✅ Confirmation dialog; user removed |

### S8B — Regular User Operations ✅

| Test | Result |
|------|--------|
| S8B.1 Regular user login | ✅ Login succeeds, redirect to `/` |
| S8B.2 Catalog (team-scoped) | ✅ 0 services shown when not in any team; correct after team assignment |
| S8B.3 Admin page blocked | ✅ Redirect to `/` when accessing `/admin/users` |
| S8B.4 View service docs | ✅ Redirected when no team access; works correctly after team assignment |
| S8B.5 Own MCP tokens | ✅ Create and revoke work |
| S8B.6 Upload restriction | ❌ **Bug #2**: `team_member` can upload specs — no role restriction |
| S8B.7 Logout | ✅ Redirects to `/login` |

### S9 — Audit Logs ✅

| Test | Result |
|------|--------|
| S9.1 View audit logs | ✅ All operations logged (spec_uploaded, token_revoked, token_created, login, user_disabled) with timestamp, action, user, target, details |

### S10 — Diff ✅

| Test | Result |
|------|--------|
| S10.1 Compare branches | ✅ Form renders; "No differences found" shown for same-branch compare |
