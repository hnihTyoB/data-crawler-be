# Quy Tắc Thiết Kế Kiến Trúc (design.md)

> Quy chuẩn thiết kế phần mềm, cấu trúc các tầng và chuẩn mực mã nguồn của hệ thống `data-crawler-be`.

---

## 1. Kiến Trúc 5 Lớp (5-Layer Pattern)

Hệ thống áp dụng kiến trúc phân lớp hướng dịch vụ (Layered Clean Architecture):

```
┌────────────────────────────────────────┐
│ 1. Route (src/modules/<feature>/*.route.ts)
│    - Gắn URI, HTTP Method, Middleware (Auth, Validate, Rate-limit)
└───────────────────┬────────────────────┘
                    │
┌───────────────────▼────────────────────┐
│ 2. Controller (src/modules/<feature>/*.controller.ts)
│    - Tiếp nhận Request, trích xuất Params/Body/Query
│    - Gọi Service tương ứng
│    - Định dạng Response chuẩn HTTP (200, 201, 204...)
└───────────────────┬────────────────────┘
                    │
┌───────────────────▼────────────────────┐
│ 3. Service (src/modules/<feature>/*.service.ts)
│    - Chứa Business Logic, kiểm tra Quota, nghiệp vụ cào dữ liệu
│    - Gọi một hoặc nhiều Repository
│    - Đẩy job vào BullMQ nếu là tác vụ bất đồng bộ
└───────────────────┬────────────────────┘
                    │
┌───────────────────▼────────────────────┐
│ 4. Repository (src/modules/<feature>/*.repository.ts)
│    - Chịu trách nhiệm DUY NHẤT về việc truy vấn cơ sở dữ liệu
│    - Định nghĩa Prisma select, include, pagination, filter
└───────────────────┬────────────────────┘
                    │
┌───────────────────▼────────────────────┐
│ 5. Database (PostgreSQL via Prisma Client)
└────────────────────────────────────────┘
```

---

## 2. Xác Thực Dữ Liệu Tại Biên (Boundary Validation with Zod)

- Mọi dữ liệu đầu vào từ người dùng (Body, Query, Params) **bắt buộc** phải được định nghĩa Schema bằng **Zod** trong `<feature>.validation.ts`.
- Sử dụng middleware dùng chung `validateMiddleware`:
  ```typescript
  import { validate } from "../../middlewares/validate.middleware";
  import { createCrawlJobSchema } from "./crawl-job.validation";

  router.post("/", validate(createCrawlJobSchema), crawlJobController.create);
  ```
- Định nghĩa kiểu TypeScript tương ứng (`DTO`) bằng `z.infer<typeof schema>` trong `<feature>.dto.ts`.

---

## 3. Xử Lý Lỗi Tập Trung (Centralized Error Handling)

- Không dùng `throw new Error("...")` một cách tùy tiện.
- Bắt buộc kế thừa từ `AppError`:
  ```typescript
  import { AppError } from "../../common/errors/app-error";
  import { ERROR_CODE } from "../../common/errors/error-code";

  if (!job) {
    throw new AppError("Crawl job not found", 404, ERROR_CODE.NOT_FOUND);
  }
  ```
- Cấu trúc response trả về cho client luôn thống nhất:
  ```json
  {
    "success": false,
    "message": "Chi tiết lỗi",
    "code": "ERROR_CODE_ENUM",
    "errors": [] // (nếu là lỗi validate form)
  }
  ```

---

## 4. Hợp Đồng Dữ Liệu Cào (Data Contract V1)

Bảo toàn hợp đồng dữ liệu quy định tại `docs/DATA_CONTRACT_V1.md`:

- **Trang Cào (`CrawlPage`):**
  - `url`, `normalizedUrl`: URL chuẩn hóa (loại bỏ tracking query params không cần thiết).
  - `markdownContent`: Nội dung chính sau khi dọn sạch thẻ rác HTML.
  - `structuredData`: Dữ liệu bóc tách dựa trên Extraction Template.
  - `dataQualityScore`: Điểm chất lượng nội dung (tính dựa trên tỷ lệ text/tag, mật độ từ).
  - `hasSensitiveData`: Cờ phát hiện email/số điện thoại/khóa API nhạy cảm.

---

## 5. Trừu Tượng Hóa Tầng Lưu Trữ (Storage Abstraction)

- Mọi thao tác ghi file kết quả export và lưu trữ asset phải đi qua interface lưu trữ chung tại `src/common/storage/`:
  - `LocalStorageProvider`: Lưu file tại ổ đĩa server (`storage/exports/`).
  - `S3StorageProvider`: Tải file trực tiếp lên AWS S3 hoặc MinIO tương thích S3.
- Không hardcode đường dẫn file vật lý trong tầng Controller hoặc Service.
