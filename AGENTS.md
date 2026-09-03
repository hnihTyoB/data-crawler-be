# Backend Guidance & Architecture Rules (data-crawler-be)

> Tài liệu quy tắc chuẩn cho **Antigravity** khi phát triển và bảo trì mã nguồn trong workspace `data-crawler-be`.

---

## 1. Kiến Trúc Phân Tầng Tuyệt Đối (Strict 5-Layer Pattern)

Mọi luồng dữ liệu nghiệp vụ bắt buộc tuân theo thứ tự phân tầng đơn hướng:

```
Route  →  Controller  →  Service  →  Repository  →  Prisma Client  →  PostgreSQL
```

### Quy tắc bất biến:
- **Độc quyền Prisma:** Chỉ duy nhất các file `*.repository.ts` được phép import và gọi `prisma` hoặc `PrismaClient`. Service, Controller, Worker, Helper và Middleware **tuyệt đối không** được gọi Prisma trực tiếp.
- **Tổ chức Module chuẩn (`src/modules/<feature>/`):**
  - `<feature>.route.ts`: Khai báo endpoints, gắn middleware (`auth`, `role`, `validate`, `rateLimit`).
  - `<feature>.controller.ts`: Nhận HTTP request, trích xuất parameters, gọi Service, trả response HTTP chuẩn.
  - `<feature>.service.ts`: Chứa toàn bộ Business Logic, điều phối các Repository và đẩy job vào BullMQ.
  - `<feature>.repository.ts`: Chịu trách nhiệm duy nhất về tương tác dữ liệu với Prisma (select, filter, transaction).
  - `<feature>.dto.ts` & `<feature>.validation.ts`: Định nghĩa kiểu TypeScript và schema kiểm thực Zod.
  - `__tests__/`: Chứa colocated unit/integration tests cho module.
- **Routing:** Mọi router module mới phải được mount tập trung trong `src/routes/index.ts` với prefix `/api/v1/`.
- **Mã dùng chung (`src/common/`):** Chỉ đặt vào `src/common/` (errors, helpers, constants, types, storage) khi code thực sự được tái sử dụng qua ít nhất 2 modules.

---

## 2. Dữ Liệu & Tích Hợp (Data, Prisma & Workers)

### A. Cơ sở dữ liệu & Prisma Migrations
- `prisma/schema.prisma` là nguồn chân lý duy nhất (Single Source of Truth) của database schema.
- Thao tác Prisma thông qua script runner: `node scripts/prisma-run.js <cmd>`. Runner tự động tổng hợp `DATABASE_URL` từ các biến môi trường cấu hình (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`).
- Mọi thay đổi schema phải sinh migration tương ứng bằng `pnpm db:migrate` và commit đồng thời cả `schema.prisma` lẫn thư mục migration.
- **CẤM:** Không bao giờ chạy `pnpm db:migrate:reset` trừ khi người dùng yêu cầu rõ ràng việc xóa trắng dữ liệu.

### B. Hàng đợi bất đồng bộ & Worker (BullMQ + Redis)
- Các tác vụ nặng (thu thập web, gửi webhook, chạy lịch cron) phải chuyển qua hàng đợi BullMQ:
  - `crawl.queue.ts` / `crawl.worker.ts` / `crawl.worker.processor.ts`
  - `webhook.queue.ts` / `webhook.worker.ts`
  - `schedule.worker.ts`
- **Idempotency:** Worker processor phải có khả năng chạy lại mà không tạo trùng dữ liệu (dựa trên `url`, `jobId`, `contentHash`).
- **State Lifecycle:** Bảo toàn chuyển đổi trạng thái hợp lệ của `CrawlJob`:
  $$\text{PENDING} \longrightarrow \text{QUEUED} \longrightarrow \text{RUNNING} \longrightarrow \text{PROCESSING\_EXPORT} \longrightarrow \text{COMPLETED} \ / \ \text{FAILED} \ / \ \text{CANCELED}$$
- Ghi log chi tiết theo từng step vào `crawl_job_logs`.

---

## 3. Xác Thực, Xử Lý Lỗi & Hợp Đồng Dữ Liệu

- **Xác thực tại tầng biên:** Toàn bộ Body, Query và Params phải được định nghĩa bằng **Zod** và gắn middleware `validate(schema)`.
- **Chuẩn hóa lỗi:** Sử dụng `AppError` kèm mã định danh từ `src/common/errors/error-code.ts` (`ERROR_CODE.*`), không dùng `throw new Error()`.
- **Data Contract V1:** Tuân thủ cấu trúc dữ liệu theo `docs/DATA_CONTRACT_V1.md`:
  - Phân định rõ ràng giữa dữ liệu thô (raw HTML từ Firecrawl) và dữ liệu đã làm sạch (clean Markdown, structuredData, dataQualityScore).
- **Lưu trữ tệp:** Sử dụng abstraction `src/common/storage/` (hỗ trợ `local` disk và `s3` / MinIO).

---

## 4. Các Tệp Sinh Tự Động & Runtime (Do Not Hand-Edit)

- **Không chỉnh sửa thủ công:**
  - `dist/` (build artifacts)
  - `coverage/` (test reports)
  - `storage/exports/*` (runtime export files)
  - `src/docs/swagger.json` (sinh tự động qua Swagger Autogen)
- Khi thay đổi router, query params, request body hoặc Swagger tags, chạy lại:
  ```bash
  pnpm swagger
  ```

---

## 5. Quy Trình Kiểm Thử & Kiểm Định Chất Lượng (QA Commands)

Thực hiện tất cả các lệnh từ thư mục `data-crawler-be/`:

```bash
# 1. Chạy test đơn lẻ hoặc theo thư mục
pnpm test -- <path-to-test> --runInBand

# 2. Chạy toàn bộ test suite
pnpm test -- --runInBand

# 3. Kiểm tra cú pháp và quy chuẩn mã nguồn
pnpm lint

# 4. Format mã nguồn
pnpm format

# 5. Build kiểm tra biên dịch TypeScript
pnpm build
```

Bắt buộc bổ sung Jest test trong thư mục `__tests__/` cho mọi Service, Worker, Repository logic, Export pipeline hoặc Data Contract mới được thêm vào hoặc chỉnh sửa.
