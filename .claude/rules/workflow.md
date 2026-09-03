# Quy Tắc Quy Trình Phát Triển (workflow.md)

> Quy định về các bước làm việc, quy chuẩn Git, cơ sở dữ liệu và kiểm thử chất lượng mã nguồn trong `data-crawler-be`.

---

## 1. Quy Trình Phát Triển Tính Năng Mới (Feature Lifecycle)

Khi xây dựng một module hoặc tính năng mới, Agent cần thực hiện tuần tự theo 6 bước:

```
[1. Khảo sát Schema & Yêu Cầu]
        ↓
[2. Viết Repository (Prisma Query)]
        ↓
[3. Viết Service (Business Logic & Validation)]
        ↓
[4. Viết Controller & Định nghĩa Route]
        ↓
[5. Đăng ký Route vào index.ts & Viết Swagger]
        ↓
[6. Viết Jest Test & Chạy Lint]
```

---

## 2. Quy Chuẩn Git & Commit Message

Tuân thủ chuẩn **Conventional Commits**:

- `feat(module):` Thêm tính năng mới (ví dụ: `feat(crawl-jobs): add priority queue option`)
- `fix(module):` Sửa lỗi (ví dụ: `fix(auth): handle expired refresh token race condition`)
- `refactor(module):` Tái cấu trúc mã mà không đổi hành vi nghiệp vụ
- `test(module):` Thêm hoặc cập nhật unit tests
- `docs(module):` Cập nhật tài liệu, Swagger, README
- `chore:` Thay đổi cấu hình build, dependencies, tooling

---

## 3. Quy Trình Làm Việc Với Cơ Sở Dữ Liệu (Prisma Migration Workflow)

Khi cần thay đổi cấu trúc bảng hoặc thêm trường mới:

1. Chỉnh sửa schema tại `prisma/schema.prisma`.
2. Tạo và áp dụng migration:
   ```bash
   pnpm db:migrate
   # Hoặc nếu là lần đầu: pnpm db:migrate:init
   ```
3. Sinh lại Prisma Client để cập nhật kiểu dữ liệu TypeScript:
   ```bash
   pnpm prisma:generate
   ```
4. Kiểm tra trạng thái migration:
   ```bash
   pnpm db:migrate:status
   ```
5. **QUAN TRỌNG:** Commit cả file `schema.prisma` lẫn thư mục migration mới được sinh ra trong `prisma/migrations/`.

---

## 4. Quy Trình Kiểm Thử & Kiểm Tra Chất Lượng (QA & Validation)

Trước khi coi một tác vụ là hoàn thành, Agent bắt buộc phải chạy các bước kiểm tra sau:

```bash
# 1. Kiểm tra định dạng và quy chuẩn cú pháp:
pnpm lint

# 2. Cập nhật tài liệu API:
pnpm swagger

# 3. Chạy test suite:
pnpm test -- --runInBand

# 4. Kiểm tra khả năng build production:
pnpm build
```

---

## 5. Quy Trình Bổ Sung Queue Worker

Khi tạo thêm Worker xử lý tác vụ nền:

1. Tạo Queue tại `src/queues/<job-name>.queue.ts`.
2. Tạo Processor xử lý logic tại `src/queues/<job-name>.worker.processor.ts`.
3. Khởi tạo Worker file tại `src/queues/<job-name>.worker.ts`.
4. Đảm bảo cấu hình retry với exponential backoff và cơ chế log lỗi vào cơ sở dữ liệu.
