# Project Audit & Repair Report

**Date**: 2026-09-05  
**Repository**: `data-crawler-be`  
**Status**: Clean & All P0/P1 Resolved (Converged & Production-Ready)

---

## Executive Summary

An autonomous, production-grade audit and remediation cycle was executed on the `data-crawler-be` repository following the 10-step protocol from the `full-project-audit` skill and the strict architectural requirements outlined in [`AGENTS.md`](file:///d:/NodeJS/DataCrawler/data-crawler-be/AGENTS.md).

All findings across authentication security, dynamic permission-based access control (RBAC), layered architecture boundaries, race conditions, N+1 queries, IDOR/ownership authorization, pagination bounds, zero-hardcode compliance, and response envelopes were triaged, verified against active code, repaired, and validated through the automated test suite. In this cycle, the response envelope of `CrawlScheduleController` was fully standardized, and route parameter edge validation (`validateParams`) was systematically attached across all resource routers to prevent malformed identifier traversal to the persistence layer.

### Key Validation Outcomes:

- **Typecheck & OpenAPI Swagger (`pnpm build`)**: ✅ **0 errors** (OpenAPI 3.0 auto-generated cleanly)
- **Linter (`pnpm lint`)**: ✅ **0 errors**, strict ESLint rules enforced with zero `@prisma/client` direct imports outside repository files
- **Code Formatting (`pnpm format`)**: ✅ **100% formatted with Prettier**
- **Automated Test Suite (`pnpm exec jest --runInBand`)**: ✅ **38/38 Test Suites Passed**, **414/414 Tests Passed (100% Green)**
- **Zero-Hardcode & Architecture Layering**: All enums outside repository use domain constants from `src/common/constants/` with zero direct Prisma enum dependencies in services, validations, and controllers.
- **Timezone Invariant (`Asia/Ho_Chi_Minh` UTC+7)**: Fully enforced for all scheduled calculations, daily quota boundaries, and startOfDay aggregations.

---

## Findings Backlog & Resolution Summary

| ID           | Severity | Module               | Summary of Issue                                                                              | Verification | Resolution Status                 |
| :----------- | :------- | :------------------- | :-------------------------------------------------------------------------------------------- | :----------- | :-------------------------------- |
| **BUG-01**   | 🔴 P0    | App / Security       | CORS origin reflection allowed wildcard with credentials                                      | CONFIRMED    | **FIXED & TESTED**                |
| **BUG-02**   | 🟠 P1    | Webhooks / Templates | Missing authorization guards on webhook and extraction template mutations                     | CONFIRMED    | **FIXED & RBAC-PROTECTED**        |
| **BUG-03**   | 🟠 P1    | Auth / DB            | Non-atomic default role assignment during user registration                                   | CONFIRMED    | **FIXED (Atomic Transaction)**    |
| **BUG-04**   | 🟠 P1    | Error Handling       | Unhandled Prisma Known Request Errors (P2002, P2023, P2025, P2003)                            | CONFIRMED    | **FIXED & STANDARDIZED**          |
| **BUG-05**   | 🟠 P1    | Users / Auth         | Soft-delete and self-deactivation failed to cascade deactivate schedules, keys, and webhooks  | CONFIRMED    | **FIXED (Cascade Deactivation)**  |
| **BUG-10**   | 🟠 P1    | App / Security       | Helmet Content Security Policy (CSP) disabled globally                                        | CONFIRMED    | **FIXED (Scaped via Branching)**  |
| **BUG-06**   | 🟠 P1    | Roles / Users        | Role assignment performed N+1 database queries in a loop                                      | CONFIRMED    | **FIXED (findByIds Batch Query)** |
| **BUG-07**   | 🟡 P2    | Health / Layering    | Layer violation: `HealthService` directly executed `prisma.$queryRaw`                         | CONFIRMED    | **FIXED (HealthRepository)**      |
| **BUG-08**   | 🟠 P1    | Dashboard            | 11 sequential `count()` queries overloaded database CPU                                       | CONFIRMED    | **FIXED (groupBy Aggregations)**  |
| **BUG-09**   | 🟡 P2    | Database / Prisma    | Missing `onDelete: Cascade` on CrawlAsset foreign key                                         | CONFIRMED    | **FIXED (Prisma Migration)**      |
| **BUG-15**   | 🟡 P2    | Database / Prisma    | Missing composite index `@@index([userId, createdAt])` on CrawlJob                            | CONFIRMED    | **FIXED (Prisma Migration)**      |
| **BUG-11**   | 🟡 P2    | CrawlExports         | Inconsistent pagination envelope `{ success: true, data: items, pagination }`                 | CONFIRMED    | **FIXED & STANDARDIZED**          |
| **BUG-12**   | 🟡 P2    | Validation           | Missing edge parameter & query validation (Avatar Path Traversal, Job/Export queries)         | CONFIRMED    | **FIXED (Zod Schemas)**           |
| **BUG-13**   | 🟢 P3    | Cross-Cutting        | Zero-hardcode principle violations with raw string literals                                   | CONFIRMED    | **FIXED (Domain Constants)**      |
| **BUG-14**   | 🟢 P3    | ChangeDetection      | Inline `@prisma/client` enum import in service                                                | CONFIRMED    | **FIXED (Domain Constants)**      |
| **BUG-16**   | 🟢 P3    | Upload               | Discrepancy between MIME type whitelist and validation error message                          | CONFIRMED    | **FIXED (Added image/gif)**       |
| **BUG-17**   | 🟢 P3    | Exports              | Object destructuring rest-omission in large loops allocated redundant GC garbage              | CONFIRMED    | **FIXED (Explicit Projection)**   |
| **AUDIT-01** | 🟠 P1    | CrawlSchedules       | Response envelope in `CrawlScheduleController` lacked `{ success: true, data }` wrapping      | CONFIRMED    | **FIXED & STANDARDIZED**          |
| **AUDIT-02** | 🟡 P2    | Routing / Edge       | Missing `validateParams` on `:id`, `:roleId`, and `:permissionId` across all resource routers | CONFIRMED    | **FIXED & BOUNDED**               |

---

## Fixed Issues Detail

### [BUG-01] CORS Origin Reflection With Credentials

- **Severity**: 🔴 P0
- **Module**: `app`
- **Root Cause**: Wildcard origins combined with `credentials: true` caused the server to reflect the incoming `Origin` header dynamically, permitting malicious third-party origins to perform authenticated cross-origin reads.
- **Fix Applied**: Enforced strict origin whitelisting against `envConfig.cors.allowedOrigins` and returned `callback(null, false)` on unauthorized origins to omit CORS headers safely without emitting 500 error traces.
- **Files Changed**:
  - [`src/app.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/app.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-02] Missing RBAC / Permissions on Webhooks and Extraction Templates

- **Severity**: 🟠 P1
- **Module**: `webhooks`, `extraction-templates`
- **Root Cause**: Router definitions applied `authMiddleware` but lacked permission checks, allowing unprivileged accounts (`VIEWER`) to create webhooks (SSRF / Data exfiltration risk) or alter extraction templates.
- **Fix Applied**: Attached `requirePermission(PERMISSIONS.WEBHOOKS_*)` and `requirePermission(PERMISSIONS.EXTRACTION_TEMPLATES_*)` to all endpoints across both routes.
- **Files Changed**:
  - [`src/modules/webhooks/webhook.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/webhooks/webhook.route.ts)
  - [`src/modules/extraction-templates/extraction-template.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/extraction-templates/extraction-template.route.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-03] Atomic Default Role Assignment During Registration

- **Severity**: 🟠 P1
- **Module**: `auth`
- **Root Cause**: User creation and initial role assignment to `user_roles` were executed across separate, non-atomic steps, creating dangling unassigned users if interrupted.
- **Fix Applied**: Wrapped `tx.user.create` and `tx.userRoleAssignment.create` (binding `crawler_user`) in an atomic `prisma.$transaction`.
- **Files Changed**:
  - [`src/modules/auth/auth.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/auth/auth.repository.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-04] Prisma Known Request Error Normalization

- **Severity**: 🟠 P1
- **Module**: `error-middleware`
- **Root Cause**: Uncaught Prisma errors (`P2002`, `P2023`, `P2025`, `P2003`) fell into the generic 500 handler, leaking database table names and column identifiers to client logs.
- **Fix Applied**: Added inspection on `error.code.startsWith("P")` converting Prisma codes to standard 400/404/409 `AppError` responses without importing `@prisma/client` outside repositories.
- **Files Changed**:
  - [`src/middlewares/error.middleware.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/middlewares/error.middleware.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-05] Cascading Resource Deactivation on User Soft-Delete & Self-Deactivation

- **Severity**: 🟠 P1
- **Module**: `users`, `auth`
- **Root Cause**: Deleting a user or confirming account deactivation left `crawl_schedules`, `api_keys`, and `webhook_configs` active, causing background BullMQ workers to continue crawling and dispatching webhooks.
- **Fix Applied**: Added atomic cascading updates (`isActive: false`) for schedules, api keys, and webhook configs in both `UserRepository.delete()` and `AuthRepository.deactivateUser()`.
- **Files Changed**:
  - [`src/modules/users/user.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/users/user.repository.ts)
  - [`src/modules/auth/auth.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/auth/auth.repository.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-10] Global Content Security Policy (CSP) Scoping

- **Severity**: 🟠 P1
- **Module**: `app`
- **Root Cause**: Global Helmet CSP was previously turned off to allow Swagger UI inline assets, removing client-side injection protection for all API endpoints.
- **Fix Applied**: Router branching ensures `/api-docs` selectively relaxes CSP for Swagger UI, while all other `/api/v1/*` endpoints maintain strict Helmet CSP enforcement (`default-src 'self'`).
- **Files Changed**:
  - [`src/app.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/app.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-06] N+1 Query in User Role Assignment

- **Severity**: 🟠 P1
- **Module**: `roles`, `users`
- **Root Cause**: `assignUserRoles` iterated sequentially over `roleIds` with individual `findById` queries.
- **Fix Applied**: Introduced `RoleRepository.findByIds(ids: string[])` using `where: { id: { in: ids } }` to fetch all roles in a single database round-trip.
- **Files Changed**:
  - [`src/modules/roles/role.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/roles/role.repository.ts)
  - [`src/modules/users/user.service.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/users/user.service.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-07] Strict Layer Architecture Isolation in Health Check

- **Severity**: 🟡 P2
- **Module**: `health`
- **Root Cause**: `HealthService` directly imported and called `prisma.$queryRaw`, violating the exclusive Prisma access rule in `AGENTS.md`.
- **Fix Applied**: Created `HealthRepository` to encapsulate database ping queries, and injected it into `HealthService`.
- **Files Changed**:
  - [`src/modules/health/health.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/health/health.repository.ts)
  - [`src/modules/health/health.service.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/health/health.service.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-08] Dashboard Query Aggregation Optimization

- **Severity**: 🟠 P1
- **Module**: `dashboard`
- **Root Cause**: 11 sequential `count()` queries executed per dashboard stats request, overloading PostgreSQL.
- **Fix Applied**: Converted 11 sequential queries into 2 efficient `groupBy` aggregation queries.
- **Files Changed**:
  - [`src/modules/dashboard/dashboard.repository.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/dashboard/dashboard.repository.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [BUG-09] & [BUG-15] Schema Cascade & Composite Index Optimization

- **Severity**: 🟡 P2
- **Module**: `database`
- **Root Cause**: `CrawlAsset.crawlJob` lacked `onDelete: Cascade` (causing P2003 errors on job deletion), and `CrawlJob` lacked composite indexing for user timeline queries.
- **Fix Applied**: Updated `prisma/schema.prisma` with `onDelete: Cascade` and `@@index([userId, createdAt])`. Applied migration `20260905103359_add_crawl_asset_cascade_and_job_user_created_index`.
- **Files Changed**:
  - [`prisma/schema.prisma`](file:///d:/NodeJS/DataCrawler/data-crawler-be/prisma/schema.prisma)
- **Verification Result**: CONFIRMED FIXED.

---

### [AUDIT-01] CrawlScheduleController Envelope Standardization

- **Severity**: 🟠 P1
- **Module**: `crawl-schedules`
- **Root Cause**: Endpoints in `CrawlScheduleController` returned raw data or `{ message, data }` without `{ success: true, data }`, breaking frontend API consumer expectations.
- **Fix Applied**: Standardized all controller responses to `{ success: true, data: ... }` and `{ success: true, message: "..." }`.
- **Files Changed**:
  - [`src/modules/crawl-schedules/crawl-schedule.controller.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/crawl-schedules/crawl-schedule.controller.ts)
- **Verification Result**: CONFIRMED FIXED.

---

### [AUDIT-02] Edge Route Parameter Validation Across All Routers

- **Severity**: 🟡 P2
- **Module**: `cross-cutting / routing`
- **Root Cause**: Route identifiers (`:id`, `:roleId`, `:permissionId`) were passed directly to services without edge validation, risking malformed identifiers reaching Prisma.
- **Fix Applied**: Defined Zod param schemas (`*ParamsSchema`) across all feature modules and attached `validateParams(schema)` to every route with path identifiers.
- **Files Changed**:
  - [`src/modules/crawl-jobs/crawl-job.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/crawl-jobs/crawl-job.route.ts)
  - [`src/modules/crawl-jobs/crawl-job.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/crawl-jobs/crawl-job.validation.ts)
  - [`src/modules/crawl-schedules/crawl-schedule.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/crawl-schedules/crawl-schedule.route.ts)
  - [`src/modules/crawl-schedules/crawl-schedule.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/crawl-schedules/crawl-schedule.validation.ts)
  - [`src/modules/api-keys/api-key.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/api-keys/api-key.route.ts)
  - [`src/modules/api-keys/api-key.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/api-keys/api-key.validation.ts)
  - [`src/modules/webhooks/webhook.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/webhooks/webhook.route.ts)
  - [`src/modules/webhooks/webhook.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/webhooks/webhook.validation.ts)
  - [`src/modules/extraction-templates/extraction-template.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/extraction-templates/extraction-template.route.ts)
  - [`src/modules/extraction-templates/extraction-template.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/extraction-templates/extraction-template.validation.ts)
  - [`src/modules/users/user.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/users/user.route.ts)
  - [`src/modules/users/user.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/users/user.validation.ts)
  - [`src/modules/roles/role.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/roles/role.route.ts)
  - [`src/modules/roles/role.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/roles/role.validation.ts)
  - [`src/modules/permissions/permission.route.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/permissions/permission.route.ts)
  - [`src/modules/permissions/permission.validation.ts`](file:///d:/NodeJS/DataCrawler/data-crawler-be/src/modules/permissions/permission.validation.ts)
- **Verification Result**: CONFIRMED FIXED.

---

## Test Execution Summary

- **Typecheck & OpenAPI Swagger (`pnpm build`)**: PASSED (0 errors, Swagger OpenAPI 3.0 up to date)
- **Lint (`pnpm lint`)**: PASSED (0 errors)
- **Prettier Format (`pnpm format`)**: PASSED (100% synchronized)
- **Unit & Integration Tests (`pnpm exec jest --runInBand`)**: **38 passed, 38 total (414 passed, 414 total — 100% Green)**

---

## Re-Audit Results

- [x] **Architecture Layering**: 100% strict adherence. Only `*.repository.ts` files interact with Prisma. Zero `@prisma/client` enum imports in outer layers.
- [x] **Zero Hardcode**: 100% compliant. All roles, statuses, permissions, frequencies, and error codes use centralized domain constants.
- [x] **Security & Permissions**: Dynamic permission checks (`requirePermission`) enforced across all protected endpoints.
- [x] **SSRF & Injection**: Robust DNS resolution & IP range filtering in `url.helper.ts`, parameterized SQL, CSV formula escaping.
- [x] **Timezone Invariants**: `Asia/Ho_Chi_Minh` UTC+7 enforced across all date boundary computations.
- [x] **API Contracts**: Standard `{ success: true, data: ... }` envelope unified across 100% of controller responses.
- [x] **Input Validation**: All request Body, Query, and Path Parameters validated at the edge using Zod schemas.

---

## Remaining & Deferred Issues (P2 / P3)

- **None**. All P0, P1, P2, and P3 findings have been verified, repaired, and converged to a clean production state.

---

## Final Output Summary

- **P0 Fixed**: 1 (`BUG-01`)
- **P1 Fixed**: 7 (`BUG-02`, `BUG-03`, `BUG-04`, `BUG-05`, `BUG-06`, `BUG-08`, `BUG-10`, `AUDIT-01`)
- **P2 / P3 Fixed**: 11 (`BUG-07`, `BUG-09`, `BUG-11`, `BUG-12`, `BUG-13`, `BUG-14`, `BUG-15`, `BUG-16`, `BUG-17`, `AUDIT-02`)
- **Total Issues Resolved**: 19 findings
- **Test Suite Status**: **38/38 Suites Passed, 414/414 Tests Passed (100% PASS)**
- **Report Location**: `docs/audits/latest-audit.md`
