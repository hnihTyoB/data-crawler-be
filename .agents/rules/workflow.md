# Quy Tắc Quy Trình Phát Triển (workflow.md)

> Hướng dẫn quy trình phát triển tính năng, kiểm thử, migration cơ sở dữ liệu và quy chuẩn Git cho Antigravity.

---

## 1. Vòng Đời Triển Khai Tính Năng (Feature Lifecycle)

Khi xây dựng hoặc sửa đổi tính năng trong `data-crawler-be`, thực hiện tuần tự:

1. **Khảo sát & Thiết kế:** Kiểm tra quan hệ trong `prisma/schema.prisma` và tài liệu `docs/DATA_CONTRACT_V1.md`.
2. **Tầng Repository:** Viết hàm truy vấn Prisma trong `src/modules/<feature>/<feature>.repository.ts`.
3. **Tầng Service:** Viết business logic, kiểm tra quota, tích hợp BullMQ queue trong `<feature>.service.ts`.
4. **Tầng Controller & DTO:** Định nghĩa Zod schema trong `<feature>.validation.ts`, kiểu DTO trong `<feature>.dto.ts`, xử lý HTTP request trong `<feature>.controller.ts`.
5. **Gắn Route & Swagger:** Mount route tại `<feature>.route.ts`, đăng ký vào `src/routes/index.ts`, chạy `pnpm swagger`.
6. **Kiểm thử & QA:** Thêm unit test vào `__tests__/`, chạy `pnpm lint` và `pnpm test -- --runInBand`.

---

## 2. Quy Chuẩn Commit Git

Áp dụng chuẩn Conventional Commits:

- `feat(<module>):` Thêm chức năng mới
- `fix(<module>):` Sửa lỗi nghiệp vụ hoặc kỹ thuật
- `refactor(<module>):` Tối ưu hóa code mà không thay đổi tính năng
- `test(<module>):` Bổ sung hoặc sửa đổi unit test
- `docs(<module>):` Cập nhật tài liệu, Swagger, README
- `chore:` Nâng cấp gói, cấu hình môi trường, script

---

## 3. Quy Trình Làm Việc Với Prisma Database

- Mọi thay đổi cấu trúc bảng thực hiện tại `prisma/schema.prisma`.
- Luôn chạy migration thông qua script runner:
  ```bash
  # Tạo và áp dụng migration development
  pnpm db:migrate
  # Sinh lại Prisma Client
  pnpm prisma:generate
  # Kiểm tra trạng thái
  pnpm db:migrate:status
  ```
- **Nghiêm cấm:** Không chạy `pnpm db:migrate:reset` khi chưa được sự xác nhận rõ ràng của người dùng.
