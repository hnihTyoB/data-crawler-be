# Công Nghệ Mặc Định & Cấu Hình Chuẩn (tech-defaults.md)

> Bảng quy ước phiên bản và danh mục công nghệ cốt lõi trong `data-crawler-be`.

---

## 1. Môi Trường Thực Thi & Ngôn Ngữ

- **Node.js:** `>= 20.x`
- **Package Manager:** `pnpm@9.15.0` (chỉ dùng `pnpm`, không dùng `npm` hay `yarn`)
- **TypeScript:** `5.7` (`strict: true`, không dùng `any` bừa bãi)
- **Web Framework:** `Express.js 4.21`

---

## 2. Lưu Trữ & Hàng Đợi

- **Cơ sở dữ liệu:** PostgreSQL 15+ (chạy Docker local qua `docker-compose.yml`)
- **ORM:** Prisma `5.22.x` (quản lý qua `scripts/prisma-run.js`)
- **Queue / In-Memory Store:** Redis 7 + `bullmq ^5.34.0`
- **Storage Driver:** Hỗ trợ song song Local (`storage/exports/`) và S3/MinIO (`@aws-sdk/client-s3`)

---

## 3. Crawl & Làm Sạch Dữ Liệu

- **Crawl Engine:** `@mendable/firecrawl-js ^1.19.0` (SCRAPE, CRAWL, SITEMAP, URL_LIST)
- **DOM Parser:** `cheerio ^1.2.0` & `node-html-parser ^8.0.4`
- **Markdown Conversion:** `turndown ^7.2.0`
- **Export formats:** `exceljs ^4.4.0` (XLSX), `json2csv ^6.0.0-alpha.2` (CSV), `archiver ^7.0.1` (ZIP)

---

## 4. Bảo Mật & Xác Thực

- **Auth:** JWT (`jsonwebtoken ^9.0.2`, Access Token + Refresh Token trong database)
- **Hash:** `bcryptjs ^2.4.3`
- **Rate Limit:** `express-rate-limit ^8.5.2`
- **HTTP Headers:** `helmet ^8.0.0` (tắt CSP cho Swagger UI)
- **Phân quyền (RBAC):** `ADMIN`, `CRAWLER_USER`, `VIEWER`
