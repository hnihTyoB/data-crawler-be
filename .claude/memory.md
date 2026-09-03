# memory.md - Bộ Nhớ Bền Vững Của Claude (Project Persistent Memory)

> File lưu trữ ngữ cảnh kiến trúc, các quyết định kỹ thuật quan trọng và lưu ý đặc thù của dự án `data-crawler-be`.

---

## 1. Trạng Thái Hiện Tại Của Hệ Thống

- **Các module đã hoàn thiện trong `src/modules/`:**
  - `auth`: Đăng ký, đăng nhập JWT (access token trong cookie/header, refresh token lưu database), đổi mật khẩu.
  - `users`: Quản lý người dùng và quota (giới hạn số trang, số job mỗi ngày, số job đồng thời).
  - `crawl-jobs`: Tạo job, xem danh sách, chi tiết tiến độ, hủy job, retry job.
  - `crawl-pages`: Lưu trữ các trang đã cào được (`CrawlPage`), kiểm tra chất lượng nội dung, bóc tách `structuredData`, cảnh báo dữ liệu nhạy cảm.
  - `crawl-assets`: Lưu hình ảnh, liên kết, PDF, file đính kèm tìm thấy trong các trang.
  - `crawl-schedules`: Lập lịch cào định kỳ với cron expressions và tần suất (DAILY, WEEKLY, MONTHLY, CUSTOM), hỗ trợ so sánh khác biệt (`autoDiff`).
  - `change-detection`: So sánh diff giữa các phiên bản cào để phát hiện nội dung trang bị thay đổi.
  - `extraction-templates`: Quản lý template trích xuất theo domain (CSS selector/JSON field mapping).
  - `crawl-exports`: Xuất kết quả cào sang `JSON`, `CSV`, `XLSX`, `MARKDOWN`, `ZIP`.
  - `firecrawl`: Wrapper tích hợp Firecrawl API (hỗ trợ scrape single page, crawl whole site, map sitemap, url list).
  - `webhooks`: Đăng ký URL webhook và phân phối kết quả (HMAC signature, retry attempts).
  - `audit-logs`: Ghi nhận lịch sử thao tác của người dùng.
  - `api-keys`: Quản lý API Key cho client bên thứ 3.
  - `health`: Kiểm tra sức khỏe dịch vụ, kết nối DB và Redis.

---

## 2. Các Quyết Định Kỹ Thuật Quan Trọng (Key Architectural Decisions)

1. **Prisma Connection Pooling & DATABASE_URL:**
   - Script `scripts/prisma-run.js` chịu trách nhiệm tạo chuỗi `DATABASE_URL` động nếu chưa có trong biến môi trường. Hỗ trợ tự động nhận diện Supabase pooler và SSL.
2. **Strict Layering Constraint:**
   - Controller chỉ nhận request, gọi Service.
   - Service chỉ chứa business logic, điều phối các Repository.
   - Chỉ `*.repository.ts` được dùng Prisma. Tuyệt đối không query Prisma trong Service/Controller.
3. **Queue Processing Workflow:**
   - Khi API nhận request cào -> Tạo record `CrawlJob` (status `PENDING` -> `QUEUED`) -> Đẩy vào `crawl.queue.ts`.
   - `crawl.worker.processor.ts` lắng nghe:
     - Chuyển status `RUNNING`.
     - Gọi Firecrawl SDK để lấy nội dung.
     - Phân tích HTML/Markdown, bóc tách link/assets, đánh giá quality score.
     - Lưu các bản ghi `CrawlPage` và `CrawlAsset`.
     - Tự động kích hoạt export nếu người dùng cấu hình export tự động.
     - Chuyển status sang `COMPLETED` (hoặc `FAILED` nếu có lỗi không thể phục hồi).
4. **Export Stream:**
   - Dùng stream với `archiver` và `exceljs` để tránh tràn bộ nhớ Node.js (out-of-memory) khi dữ liệu cào lên tới hàng trăm nghìn trang.

---

## 3. Các "Bẫy Kỹ Thuật" Cần Tránh (Gotchas & Warnings)

- **Helmet CSP và Swagger:** Helmet mặc định bật CSP khiến giao diện Swagger UI bị chặn load CSS. Trong `app.ts` đã tắt CSP riêng cho Swagger (`contentSecurityPolicy: false`).
- **Prisma Cascade Delete:** Quan hệ giữa `CrawlJob` với `CrawlPage`, `CrawlExport`, `CrawlJobLog` là `Cascade`. Xóa job sẽ xóa hết các trang liên quan.
- **Trust Proxy:** Cần gọi qua helper `parseTrustProxy` để rate limiting và lấy IP người dùng chính xác khi chạy sau Reverse Proxy/Nginx/Cloudflare.
