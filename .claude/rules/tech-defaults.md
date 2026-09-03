# Công Nghệ Mặc Định & Cấu Hình Chuẩn (tech-defaults.md)

> Danh sách công nghệ cốt lõi, phiên bản và các quy ước mặc định được áp dụng trong dự án `data-crawler-be`.

---

## 1. Môi Trường & Phiên Bản Chuẩn (Core Runtime)

| Thành phần          | Phiên bản / Thư viện | Ghi chú quy ước                                 |
| :------------------ | :------------------- | :---------------------------------------------- |
| **Node.js**         | `>= 20.x`            | Sử dụng cú pháp ES2022+ hiện đại                |
| **Package Manager** | `pnpm@9.15.0`        | Không dùng npm hay yarn để tránh lệch pnpm-lock |
| **Ngôn ngữ**        | `TypeScript 5.7`     | `strict: true`, không dùng kiểu `any` vô căn cứ |
| **Web Framework**   | `Express.js 4.21`    | Tách rời App configuration và Server listener   |

---

## 2. Cơ Sở Dữ Liệu & Bộ Nhớ Đệm (Database & Caching)

- **Database:** PostgreSQL (chạy Docker local qua `docker-compose.yml` trên port `5432`).
- **ORM:** Prisma `5.22.x`
  - Đặt tên model dạng `PascalCase`, ánh xạ bảng dạng `snake_case` thông qua `@@map("table_name")`.
  - Khóa chính luôn là UUID v4 (`@id @default(uuid()) @db.Uuid`).
  - Luôn định nghĩa `createdAt` (`@default(now())`) và `updatedAt` (`@updatedAt`).
- **Cache & Queue Broker:** Redis `7.x` (chạy trên port `6379`)
  - Kết nối thông qua thư viện `ioredis` và `bullmq`.

---

## 3. Crawl Engine & Phân Tích Nội Dung (Crawl Stack)

- **Engine thu thập:** `@mendable/firecrawl-js ^1.19.0`
  - Chế độ cào linh hoạt: `SCRAPE` (trang đơn), `CRAWL` (toàn bộ website theo độ sâu `maxDepth`), `SITEMAP` (dựa trên sơ đồ trang), `URL_LIST` (danh sách URL rời).
- **Phân tích DOM & Làm sạch nội dung:**
  - `cheerio ^1.2.0` & `node-html-parser ^8.0.4`: Bóc tách DOM, tìm kiếm selector nhanh.
  - `turndown ^7.2.0`: Chuyển đổi mã nguồn HTML đã làm sạch thành Markdown dễ đọc cho LLM.

---

## 4. Xuất Dữ Liệu & Lưu Trữ (Export & Storage)

- **Các định dạng hỗ trợ:**
  - `JSON`: JSON mảng các trang thu thập được.
  - `CSV`: Tạo bằng `json2csv ^6.0.0-alpha.2`.
  - `XLSX`: Tạo bằng `exceljs ^4.4.0` (hỗ trợ phân tab, tự động tính độ rộng cột).
  - `MARKDOWN`: Xuất file `.md` từng trang.
  - `ZIP`: Đóng gói toàn bộ file xuất kèm thư mục assets bằng `archiver ^7.0.1`.
- **Cloud Storage:** `@aws-sdk/client-s3` và `@aws-sdk/lib-storage` (tương thích AWS S3 và MinIO).

---

## 5. Bảo Mật & Xác Thực (Security & Auth)

- **Mã hóa mật khẩu:** `bcryptjs ^2.4.3` với salt round chuẩn = 10.
- **Token:** `jsonwebtoken ^9.0.2` (Access token thời hạn 1 ngày, Refresh token 7 ngày lưu database).
- **Bảo vệ HTTP:** `helmet ^8.0.0` (tắt CSP cho Swagger), `cors ^2.8.5`, `express-rate-limit ^8.5.2`.
- **Phân quyền (RBAC):**
  - `ADMIN`: Toàn quyền hệ thống, quản lý người dùng, xem toàn bộ log.
  - `CRAWLER_USER`: Người dùng tiêu chuẩn, có thể tạo job cào và xuất file theo quota.
  - `VIEWER`: Chỉ xem danh sách job và tải dữ liệu đã cào sẵn.
