# CLAUDE.md - Bộ Não Dự Án (data-crawler-be)

> Tài liệu hướng dẫn trung tâm dành cho Claude Agent khi làm việc trên mã nguồn **data-crawler-be**.

---

## 1. Tổng quan Dự Án (Project Overview)

- **Tên dự án:** `data-crawler-be`
- **Mục đích:** Dịch vụ Backend API cho hệ thống thu thập dữ liệu web (Data Crawler & Scraper). Hỗ trợ nhận URL, crawl website tự động (qua Firecrawl API hoặc scraper engine nội bộ), chuẩn hóa nội dung (HTML -> Markdown/Text), trích xuất structured data (sử dụng Extraction Templates), lưu trữ tài nguyên (assets) và xuất dữ liệu sang các định dạng `JSON`, `CSV`, `XLSX`, `MARKDOWN`, `ZIP`.
- **Cơ chế xử lý:** Bất đồng bộ dựa trên hàng đợi **BullMQ + Redis**, worker phân luồng xử lý riêng biệt.
- **Package Manager:** `pnpm@9.15.0` (tuân thủ nghiêm ngặt, không dùng `npm` hay `yarn`).

---

## 2. Kiến Trúc Cốt Lõi (Architectural Golden Rules)

Mọi luồng xử lý dữ liệu nghiệp vụ bắt buộc phải tuân theo thứ tự phân tầng 5 lớp (Strict Layered Architecture):

```
Route  →  Controller  →  Service  →  Repository  →  Prisma Client  →  PostgreSQL
```

### Quy tắc bất di bất dịch:

1. **Chỉ Repository được gọi Prisma:** Tuyệt đối **chỉ có** các file `*.repository.ts` được import `prisma` hoặc `PrismaClient`. Service, Controller, Worker hay Helper **không bao giờ** được gọi Prisma trực tiếp.
2. **Cấu trúc Module chuẩn:** Mọi tính năng nghiệp vụ đặt tại `src/modules/<feature>/` với đầy đủ các file quy chuẩn:
   - `<feature>.route.ts`: Định nghĩa endpoint, gắn middleware (auth, validate, rate-limit).
   - `<feature>.controller.ts`: Xử lý HTTP request/response, bắt lỗi chuyển cho next hoặc dùng AppError.
   - `<feature>.service.ts`: Xử lý logic nghiệp vụ thuần túy, gọi một hoặc nhiều repository.
   - `<feature>.repository.ts`: Thao tác trực tiếp với cơ sở dữ liệu qua Prisma.
   - `<feature>.dto.ts` & `<feature>.validation.ts`: Định nghĩa types và schema xác thực Zod.
   - `__tests__/`: Unit/Integration tests sử dụng Jest.
3. **Routing tập trung:** Tất cả route của module phải được đăng ký vào `src/routes/index.ts` và gắn prefix `/api/v1`.
4. **Mã dùng chung:** Chỉ đưa vào `src/common/` khi code thực sự được tái sử dụng ở từ 2 module trở lên (errors, helpers, constants, types, storage drivers).

---

## 3. Quản Lý Cơ Sở Dữ Liệu & Prisma

- **File nguồn chân lý:** `prisma/schema.prisma`.
- **Cơ chế chạy Prisma:** Dự án dùng script bọc `scripts/prisma-run.js` để tự động tổng hợp `DATABASE_URL` từ các biến môi trường rời rạc (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`).
- **Lệnh migration an toàn:**
  - `pnpm db:migrate`: Tạo và chạy migration trong môi trường development.
  - `pnpm db:migrate:deploy`: Chạy migration trong môi trường production/CI.
  - `pnpm prisma:generate`: Sinh lại Prisma Client sau khi sửa schema.
  - `pnpm prisma:studio`: Mở giao diện xem dữ liệu Prisma.
- **CẤM:** Tuyệt đối **không** tự ý chạy `pnpm db:migrate:reset` trừ khi người dùng yêu cầu rõ ràng việc xóa trắng dữ liệu local.

---

## 4. Hàng Đợi & Worker (BullMQ + Redis)

- Các tác vụ nặng (crawl dữ liệu, chạy lịch biểu schedule, gửi webhook) đều đưa vào hàng đợi:
  - `crawl.queue.ts` & `crawl.worker.processor.ts` (Worker: `crawl.worker.ts`)
  - `webhook.queue.ts` & `webhook.worker.ts`
  - `schedule.worker.ts`
- **Quy tắc Worker:**
  - Xử lý phải có tính **Idempotent** (chạy lại không sinh lỗi trùng lặp dữ liệu).
  - Duy trì đúng vòng đời trạng thái của Job: `PENDING` -> `QUEUED` -> `RUNNING` -> `PROCESSING_EXPORT` -> `COMPLETED` / `FAILED` / `CANCELED`.
  - Cập nhật log chi tiết vào bảng `crawl_job_logs` theo từng step.

---

## 5. Lưu Trữ & Hợp Đồng Dữ Liệu (Storage & Data Contract)

- Hỗ trợ 2 driver lưu trữ linh hoạt qua `src/common/storage/`: `local` (thư mục `storage/exports/`) hoặc `s3` (AWS S3 / MinIO).
- Tuân thủ hợp đồng dữ liệu chuẩn tại `docs/DATA_CONTRACT_V1.md`:
  - Dữ liệu thô (raw): bảo toàn cấu trúc trả về từ Firecrawl / HTML ban đầu.
  - Dữ liệu sạch (clean): Markdown chuẩn hóa, lọc thẻ rác, bóc tách metadata, tính toán `contentHash` và `dataQualityScore`.
- **Không chỉnh sửa thủ công:**
  - `dist/` (build output)
  - `storage/exports/*` (runtime files)
  - `src/docs/swagger.json` (sinh tự động qua `pnpm swagger`)

---

## 6. Lệnh Thường Dùng (Cheatsheet Commands)

Chạy tất cả lệnh từ thư mục `data-crawler-be`:

```bash
# Development
pnpm dev             # Chạy API server với ts-node-dev và tự động build swagger
pnpm worker          # Chạy Crawl Worker riêng biệt
pnpm swagger         # Sinh lại file docs Swagger từ route và controller

# Quality & Testing
pnpm lint            # Kiểm tra lỗi cú pháp ESLint
pnpm format          # Format toàn bộ code bằng Prettier
pnpm test            # Chạy toàn bộ test suite Jest (--runInBand)
pnpm test -- <path>  # Chạy test cho một file/thư mục cụ thể

# Build & Production
pnpm build           # Build Swagger và compile TypeScript sang dist/
pnpm start           # Chạy server production từ dist/server.js
```

---

## 7. Quy Tắc Ứng Xử Của Agent (Do's & Don'ts)

- **DO:** Luôn đọc kỹ code hiện có trước khi sửa đổi, kiểm tra tính tương thích type trong TypeScript.
- **DO:** Viết Jest test tương ứng khi thêm logic mới vào Service, Worker, Repository hoặc Export pipeline.
- **DO:** Dùng `AppError` kèm mã lỗi chuẩn từ `src/common/errors/error-code.ts`.
- **DON'T:** Không bypass tầng Repository để query trực tiếp từ Service/Controller.
- **DON'T:** Không commit file `.env`, `CLAUDE.local.md` hay `settings.local.json`.
- **DON'T:** Không tự ý cài đặt thêm dependency nặng nếu thư viện sẵn có đã hỗ trợ.
