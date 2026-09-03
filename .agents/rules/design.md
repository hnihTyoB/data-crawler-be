# Quy Tắc Thiết Kế Kiến Trúc (design.md)

> Chuẩn mực kiến trúc phân lớp, nguyên tắc xác thực và xử lý lỗi cho Antigravity trong `data-crawler-be`.

---

## 1. Kiến Trúc 5 Lớp Đơn Hướng (Unidirectional 5-Layer Pattern)

```
Route  →  Controller  →  Service  →  Repository  →  Prisma  →  PostgreSQL
```

- **Route:** Chỉ làm nhiệm vụ cấu hình endpoint HTTP, middleware chuỗi (auth, role, validation, rateLimit). Không viết logic xử lý.
- **Controller:** Nhận và chuyển đổi kiểu dữ liệu HTTP, gọi Service tương ứng, định dạng kết quả response `res.status(...).json(...)`.
- **Service:** Xử lý nghiệp vụ chính (Business Logic), điều phối nhiều Repository, tích hợp hàng đợi BullMQ. Service không xử lý response HTTP và **không bao giờ gọi Prisma trực tiếp**.
- **Repository:** Nơi **duy nhất** được phép import và gọi Prisma Client. Đảm bảo toàn bộ câu truy vấn (query, include, select, transaction) được cô lập tại đây.

---

## 2. Xác Thực Đầu Vào Tại Biên (Boundary Validation with Zod)

- Mọi endpoint nhận dữ liệu từ client (`body`, `query`, `params`) phải có schema kiểm thực tương ứng bằng Zod.
- Sử dụng middleware dùng chung:
  ```typescript
  import { validate } from '../../middlewares/validate.middleware';
  import { mySchema } from './my.validation';

  router.post('/', validate(mySchema), myController.create);
  ```
- DTO type được suy diễn trực tiếp từ schema: `type MyDto = z.infer<typeof mySchema>;`.

---

## 3. Quản Lý Lỗi Tập Trung (Centralized Error Handling)

- Bắt buộc dùng `AppError` kèm HTTP status code và mã `ERROR_CODE`:
  ```typescript
  import { AppError } from '../../common/errors/app-error';
  import { ERROR_CODE } from '../../common/errors/error-code';

  throw new AppError('Resource not found', 404, ERROR_CODE.NOT_FOUND);
  ```
- Định dạng response lỗi chuẩn:
  ```json
  {
    "success": false,
    "message": "Thông điệp lỗi",
    "code": "ERROR_CODE",
    "errors": []
  }
  ```

---

## 4. Hợp Đồng Dữ Liệu Cào (Data Contract V1)

Bảo toàn hợp đồng dữ liệu quy định tại `docs/DATA_CONTRACT_V1.md`:
- Dữ liệu thô (`raw`): Nguyên bản HTML từ Firecrawl.
- Dữ liệu sạch (`clean`): Markdown chuẩn hóa qua Turndown, lọc bỏ script/ads/styles, tính toán `dataQualityScore` và `contentHash`.
