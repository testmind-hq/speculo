# Speculo E2E Test Scenarios

**Target:** http://10.0.0.5:3000/
**Test Account:** admin@example.com / Qy4sYFNyfuIwBqJYqRUKOQ
**Date:** 2026-04-05

---

## S1 — Authentication

### S1.1 Login with valid credentials
1. Navigate to `/login`
2. Enter email `admin@example.com`, password `Qy4sYFNyfuIwBqJYqRUKOQ`
3. Click Sign In
- **Expected:** Redirect to `/` (Catalog page); sidebar visible; user email shown in footer

### S1.2 Login with invalid credentials
1. Navigate to `/login`
2. Enter email `wrong@example.com`, password `wrong`
3. Click Sign In
- **Expected:** Error message displayed; stay on login page

### S1.3 Logout
1. Login successfully
2. Click user name/email in sidebar footer → Dropdown → Sign out (or logout option)
- **Expected:** Redirect to `/login`; localStorage cleared

---

## S2 — Service Catalog

### S2.1 View catalog (empty state)
1. Login
2. Navigate to `/` (Catalog)
- **Expected:** Page renders; either "No services yet" empty state or service cards

### S2.2 Service card shows correct info
- **Expected:** Each card shows: service name, branch badges, endpoint count, last updated time

---

## S3 — Import / Upload

### S3.1 Upload a valid OpenAPI 3.0 YAML
1. Navigate to `/import`
2. Fill in Service Name: `test-service`, Branch: `main`
3. Drag-drop or click to select a valid OpenAPI YAML file (e.g., petstore.yaml)
4. Click Upload
- **Expected:** Success alert with endpoint count; no error

### S3.2 Upload a Swagger 2.0 JSON (auto-conversion)
1. Navigate to `/import`
2. Fill in Service Name: `swagger-service`, Branch: `main`
3. Upload a Swagger 2.0 JSON file
4. Click Upload
- **Expected:** Success alert; "converted from Swagger 2.0" note shown

### S3.3 Upload without selecting a file
1. Navigate to `/import`
2. Fill in Service Name and Branch but skip file selection
3. Click Upload
- **Expected:** Error message: "Please select a file" (or equivalent)

### S3.4 Cancel import
1. Navigate to `/import`
2. Click Cancel
- **Expected:** Navigate back to Catalog `/`

---

## S4 — Service Documentation (Scalar Viewer)

### S4.1 View service docs
1. From Catalog, click a service name or "View Docs" link
2. Navigate to `/{service}/{branch}`
- **Expected:** Scalar API reference renders; endpoint list visible; no blank page

### S4.2 Expand an endpoint
1. On the Scalar viewer, click on an endpoint
- **Expected:** Endpoint detail expands with request/response schema

---

## S5 — MCP Tokens

### S5.1 Create a read-scope token
1. Navigate to `/tokens`
2. Enter Name: `test-token`, Scope: `read`
3. Click Create
- **Expected:** Token value shown in amber alert (one-time display); MCP config JSON snippet shown; token appears in list

### S5.2 Create a write-scope token
1. Navigate to `/tokens`
2. Enter Name: `ci-token`, Scope: `write`
3. Click Create
- **Expected:** Token value shown; no MCP config snippet (write scope doesn't get it); token in list with "write" badge

### S5.3 Revoke a token
1. Navigate to `/tokens`
2. Click Revoke on an existing token
- **Expected:** Token removed from list

### S5.4 Empty state
1. Navigate to `/tokens` with no tokens
- **Expected:** "No tokens yet" message in table

---

## S6 — Language Toggle

### S6.1 Switch to Chinese
1. Login
2. Click user footer area → Language toggle → switch to 中文
- **Expected:** All UI labels switch to Chinese

### S6.2 Persist language across reload
1. Switch to Chinese (S6.1)
2. Reload the page
- **Expected:** Chinese still displayed (persisted via localStorage)

### S6.3 Switch back to English
1. While in Chinese, toggle language back to English
- **Expected:** All UI labels revert to English

---

## S7 — Admin: Teams

### S7.1 View teams list
1. Navigate to `/admin/teams`
- **Expected:** Default team visible; table with Name, Display Name, Type, Actions columns

### S7.2 Create a new team
1. Navigate to `/admin/teams`
2. Enter `test-team` in the input field, click Create Team
- **Expected:** New team appears in table

### S7.3 View team members
1. In teams list, click Members link for a team
- **Expected:** Navigate to `/admin/teams/{id}/members`; member list shown

### S7.4 View team services
1. In teams list, click Services link for a team
- **Expected:** Navigate to `/admin/teams/{id}/services`; services list shown (or empty state)

### S7.5 Delete a deletable team
1. Create a new team (S7.2)
2. Click Delete on that team
3. Confirm in dialog
- **Expected:** Team removed from list

---

## S8 — Admin: Users

### S8.1 View users list
1. Navigate to `/admin/users`
- **Expected:** User table with admin account visible

---

## S9 — Admin: Audit Logs

### S9.1 View audit logs
1. Navigate to `/admin/audit-logs`
- **Expected:** Table renders; pagination or "no results" shown

---

## S10 — Diff / Version Compare

### S10.1 View diff between branches (if service has multiple branches)
1. From Catalog, click Diff or navigate to `/diff`
- **Expected:** Diff UI renders; can select service and two branches to compare

---

## Test Data Files

Place OpenAPI test fixtures in `docs/e2e/fixtures/`:
- `petstore-3.0.yaml` — valid OpenAPI 3.0
- `petstore-2.0.json` — Swagger 2.0 for conversion test
