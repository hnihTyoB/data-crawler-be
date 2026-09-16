# Data Crawler Backend

Backend API cho hệ thống crawl dữ liệu web. Người dùng dán link, hệ thống tự động crawl, chuẩn hóa nội dung và xuất file theo nhiều định dạng (JSON, CSV, XLSX, Markdown, ZIP). Crawl job chạy bất đồng bộ qua BullMQ worker.

## Tech Stack

| Thành phần      | Công nghệ                             |
| --------------- | ------------------------------------- |
| Runtime         | Node.js + TypeScript                  |
| Framework       | Express.js                            |
| ORM             | Prisma (Code First Migration)         |
| Database        | PostgreSQL                            |
| Queue / Cache   | Redis + BullMQ                        |
| Crawl Engine    | Firecrawl API                         |
| Export          | Archiver, ExcelJS, json2csv, Turndown |
| Package Manager | pnpm@9.15.0                           |

## Kiến trúc Service Layer

Mọi luồng xử lý phải đi theo thứ tự:

```
Route → Controller → Service → Repository → Prisma → PostgreSQL
```

Chỉ file `*.repository.ts` được phép import và gọi Prisma client. Service, Controller, Worker không gọi Prisma trực tiếp.

---

## Yêu cầu môi trường

Đảm bảo đã cài đặt:

- **Node.js** >= 20.x
- **pnpm** >= 9.15.0 → `npm install -g pnpm@9.15.0`
- **Docker** + **Docker Compose** (để chạy PostgreSQL và Redis local)

---

## 1. Clone & cài dependencies

```bash
git clone <repo-url>
cd data-crawler-be

pnpm install
```

---

## 2. Cấu hình biến môi trường

```bash
cp .env.example .env
```

Mở `.env` và chỉnh các giá trị cho môi trường local:

```env
NODE_ENV=development
PORT=3000

# Database — dùng với Docker local bên dưới
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=crawl_data_db

# JWT — thay bằng chuỗi bí mật của bạn
JWT_ACCESS_SECRET=change_me_access_secret
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Firecrawl — lấy API key tại https://firecrawl.dev
FIRECRAWL_API_KEY=your_firecrawl_api_key
FIRECRAWL_BASE_URL=https://api.firecrawl.dev

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Storage
STORAGE_DRIVER=local
STORAGE_EXPORT_DIR=storage/exports

# Giới hạn crawl
MAX_CRAWL_PAGES=100
MAX_CRAWL_DEPTH=3
```

> **Lưu ý về DATABASE_URL:** Dự án **không** dùng biến `DATABASE_URL` trực tiếp trong `.env`.  
> Script `scripts/prisma-run.js` sẽ tự ghép `DATABASE_URL` từ `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` mỗi khi chạy lệnh Prisma. Không cần thêm `DATABASE_URL` thủ công.

> **Lưu ý bảo mật:** File `.env` đã có trong `.gitignore`, không commit lên repository.

---

## 3. Khởi động PostgreSQL & Redis (Docker)

```bash
docker-compose up -d
```

Kiểm tra container:

```bash
docker ps
```

Hai container cần chạy:

| Container             | Service    | Port   |
| --------------------- | ---------- | ------ |
| `crawl_data_postgres` | PostgreSQL | `5432` |
| `crawl_data_redis`    | Redis      | `6379` |

> DB name mặc định trong Docker là `crawl_data_db` — đảm bảo `DB_NAME` trong `.env` khớp với giá trị này.

---

## 4. Migration database (lần đầu)

Chạy migration để tạo toàn bộ schema:

```bash
pnpm db:migrate:init
```

Lệnh này sẽ:

1. Đọc `prisma/schema.prisma`
2. Tạo folder migration đầu tiên trong `prisma/migrations/`
3. Apply migration xuống PostgreSQL
4. Tự động generate Prisma Client

Kiểm tra trạng thái migration:

```bash
pnpm db:migrate:status
```

> **Khi thay đổi schema sau này**, dùng `pnpm db:migrate` (không cần `--name init` nữa).  
> Prisma sẽ hỏi tên migration, nhập mô tả ngắn gọn rồi Enter.

---

## 5. Seed dữ liệu mẫu

```bash
pnpm db:seed
```

Seed tạo 3 tài khoản mặc định để test:

| Email                | Password         | Role         |
| -------------------- | ---------------- | ------------ |
| `admin@crawl.local`  | `Admin@123456`   | ADMIN        |
| `crawl@crawl.local`  | `Crawler@123456` | CRAWLER_USER |
| `viewer@crawl.local` | `Viewer@123456`  | VIEWER       |

---

## 6. Chạy API Server (dev mode)

```bash
# Terminal 1
pnpm dev
```

Script `dev` sẽ tự động regenerate `swagger.json` trước khi khởi động server, sau đó watch thay đổi để hot-reload.

- API server: [http://localhost:3000](http://localhost:3000)
- Swagger UI: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 7. Chạy Worker (xử lý crawl queue)

Worker phải chạy **song song** với API server để xử lý các crawl job trong BullMQ queue. Mở terminal mới:

```bash
# Terminal 2
pnpm worker
```

Worker nhận job từ queue và thực hiện state transition:

```
PENDING → QUEUED → RUNNING → PROCESSING_EXPORT → COMPLETED / FAILED
```

> Nếu worker không chạy, crawl job sẽ ở trạng thái `QUEUED` mãi và không được xử lý.

---

## Tổng kết luồng khởi động local

```bash
# Terminal 1 — Services
docker-compose up -d

# Terminal 2 — API Server
pnpm dev

# Terminal 3 — Worker
pnpm worker
```

---

## Các lệnh hữu ích

| Lệnh                     | Mô tả                                                     |
| ------------------------ | --------------------------------------------------------- |
| `pnpm db:migrate:init`   | Tạo migration lần đầu (`--name init`)                     |
| `pnpm db:migrate`        | Tạo migration mới sau khi sửa `schema.prisma`             |
| `pnpm db:migrate:deploy` | Apply migration lên staging/production (không dùng dev)   |
| `pnpm db:migrate:reset`  | Xóa toàn bộ DB và chạy lại migration — **chỉ dùng local** |
| `pnpm db:migrate:status` | Xem trạng thái các migration đã apply                     |
| `pnpm prisma:generate`   | Regenerate Prisma Client sau khi sửa schema thủ công      |
| `pnpm prisma:studio`     | Mở Prisma Studio — GUI quản lý dữ liệu trực quan          |
| `pnpm db:seed`           | Chạy seed tạo dữ liệu mẫu                                 |
| `pnpm swagger`           | Regenerate file `src/docs/swagger.json`                   |
| `pnpm build`             | Build production bundle ra thư mục `dist/`                |
| `pnpm lint`              | Kiểm tra lỗi ESLint                                       |
| `pnpm format`            | Format code bằng Prettier                                 |

---

## Workflow thay đổi database schema

Mọi thay đổi database phải đi qua Prisma Migrate, **không sửa bảng trực tiếp trong DB**.

```
1. Sửa prisma/schema.prisma
2. pnpm db:migrate           → Prisma sinh file migration SQL
3. Commit cả schema.prisma và prisma/migrations/
```

Ví dụ commit message: `feat(db): add source_type field to crawl_jobs`

---

## Cấu trúc thư mục

```
data-crawler-be/
├── prisma/
│   ├── schema.prisma           # Nguồn chuẩn của database schema
│   ├── seed.ts                 # Dữ liệu seed mặc định
│   └── migrations/             # Lịch sử migration (commit cùng code)
├── scripts/
│   └── prisma-run.js           # Ghép DATABASE_URL từ DB_* vars rồi chạy Prisma CLI
├── src/
│   ├── config/                 # Cấu hình env, jwt, firecrawl, storage
│   ├── database/
│   │   └── prisma.client.ts    # Singleton Prisma Client (chỉ import trong *.repository.ts)
│   ├── common/
│   │   ├── constants/          # Các hằng số dùng chung (role, job-status, export-type)
│   │   ├── errors/             # AppError, error-code
│   │   ├── helpers/            # url.helper, file.helper, slug.helper
│   │   └── types/              # Mở rộng kiểu Express (express.d.ts)
│   ├── middlewares/            # auth, role, validate, error, rate-limit
│   ├── modules/
│   │   ├── auth/               # Đăng nhập, refresh token
│   │   ├── users/              # Quản lý user
│   │   ├── crawl-jobs/         # CRUD crawl job, cancel
│   │   ├── crawl-pages/        # Danh sách page đã crawl
│   │   ├── crawl-assets/       # Images, links, files phát hiện được
│   │   ├── crawl-exports/      # Quản lý file export, download
│   │   ├── firecrawl/          # Adapter gọi Firecrawl API
│   │   └── exports/            # Export service: JSON, CSV, XLSX, Markdown, ZIP
│   ├── queues/
│   │   ├── crawl.queue.ts      # Định nghĩa BullMQ queue
│   │   └── crawl.worker.ts     # Worker xử lý crawl job
│   ├── routes/
│   │   └── index.ts            # Mount tất cả module routes
│   ├── docs/
│   │   ├── swagger.ts          # Config swagger-autogen
│   │   └── swagger.json        # Output (auto-generated, không sửa tay)
│   ├── app.ts                  # Khởi tạo Express app
│   └── server.ts               # Entry point
├── docs/
│   └── postman/                # Postman collection & environment
├── storage/
│   └── exports/                # File export lưu local
├── docker-compose.yml          # PostgreSQL + Redis
├── .env.example                # Template biến môi trường
├── .npmrc                      # shamefully-hoist=true (bắt buộc cho pnpm + Prisma)
└── package.json
```

---

## 8. API Preview Dữ Liệu Clean/Raw & Data Contract cho FE / AI Agent

Hệ thống hỗ trợ chuẩn hóa dữ liệu đầu ra **Data Contract v1**, API Preview và bộ lọc chất lượng dữ liệu để phục vụ hiển thị linh hoạt trên **Frontend (FE)** và nạp dữ liệu sạch cho các **AI Agents / LLM Ingestion / RAG Pipelines**:

### 8.1 Mô hình Hai Lớp Output (Clean vs. Raw Output Model)

| Lớp Output       | Trường Dữ Liệu | Đặc Điểm & Mô Tả                                                                                                                                                                     | Đối Tượng Sử Dụng                           |
| :--------------- | :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------ |
| **Raw Output**   | `rawMarkdown`  | Nội dung Markdown thô nguyên bản thu thập từ crawler, giữ nguyên menu, header, sidebar và footer.                                                                                    | FE Debug / Reconstruct trang gốc            |
| **Clean Output** | `mainContent`  | Thân bài chính đã qua thuật toán lọc nhiễu tự động (`extractMainContent`), loại bỏ menu nav, liên kết mạng xã hội, bài viết liên quan và copyright footer. Vẫn giữ cú pháp Markdown. | **AI Agent / LLM Prompt Context / RAG**     |
| **Clean Text**   | `cleanText`    | Plain text thuần túy đã xóa sạch toàn bộ ký tự định dạng Markdown (`stripMarkdown`).                                                                                                 | Đếm từ (`wordCount`) & Hash (`contentHash`) |

### 8.2 API Endpoints Preview & Assets

- **Endpoint Preview trang**: `GET /api/v1/crawl-jobs/:id/pages/preview` (hoặc `GET /api/v1/crawl-jobs/:id/pages?preview=true`)
- **Endpoint Thu thập Tài nguyên (Assets)**: `GET /api/v1/crawl-jobs/:id/assets?assetType=IMAGE` (`assetType`: `IMAGE`, `LINK`, `PDF`, `FILE`, `VIDEO`, `OTHER`)
- **Bộ lọc tìm kiếm & chỉ số chất lượng**:
  - `status`: Lọc theo trạng thái trang (`SUCCESS`, `FAILED`, `BLOCKED`, `CAPTCHA_DETECTED`, `TIMEOUT`...).
  - `search`: Tìm kiếm từ khóa xuất hiện trong URL, tiêu đề, mô tả hoặc nội dung trang.
  - `minQualityScore` / `maxQualityScore`: Lọc theo khoảng điểm chất lượng (`dataQualityScore`: 0–100).
  - `hasTables` / `hasImages` / `hasLinks`: Lọc các trang có chứa bảng HTML, hình ảnh hay liên kết.
  - `minWordCount` / `maxWordCount`: Lọc theo số lượng từ.
  - `sortBy` & `order`: Sắp xếp theo `dataQualityScore`, `wordCount`, `crawledAt`, `createdAt`...

### 8.3 Chỉ số Chất lượng Dữ liệu & Cảnh báo (Quality Metrics & Warnings)

Mỗi bản ghi trang đã crawl trả về đầy đủ các trường đo lường chất lượng:

- **`normalizedUrl`**: URL đã loại bỏ các tham số tracking (`utm_*`, `fbclid`, `gclid`), loại bỏ fragment và chuẩn hóa host/scheme để tránh trùng lặp.
- **`wordCount`**: Số từ tính trên `cleanText`.
- **`contentHash`**: Mã SHA-256 tính từ `cleanText` phục vụ deduplication trên Vector DB.
- **`dataQualityScore`**: Thang điểm từ 0–100 tính tự động dựa trên độ dài, có tiêu đề, mô tả và nội dung chính.
- **`warnings`**: Danh sách mã cảnh báo (`NAV_NOISE`, `TOO_SHORT`, `DUPLICATE_CONTENT`, `MISSING_TITLE`, `MISSING_DESCRIPTION`, `LOW_QUALITY_SCORE`).
- **`hasSensitiveData`**: Cờ đánh dấu phát hiện dữ liệu nhạy cảm.

### 8.4 Cấu trúc File Export ZIP (`exportType: "ZIP"`)

Khi xuất file gói ZIP, hệ thống phân chia rõ ràng thư mục clean/raw để AI Agent dễ dàng quét dữ liệu:

```
export-job-c4b8e21a.zip
├── data/
│   ├── raw/pages.raw.json       # Dữ liệu JSON thô (chứa rawMarkdown)
│   ├── clean/pages.clean.json   # Dữ liệu JSON sạch (chứa mainContent & cleanText)
│   ├── pages.json               # Envelope JSON tổng thể
│   ├── pages.csv                # Bảng CSV danh sách trang kèm chỉ số chất lượng & pageId
│   ├── links.csv                # Danh sách liên kết nội/ngoại bộ (CSV)
│   ├── images.csv               # Danh sách hình ảnh (CSV)
│   ├── pages.xlsx               # Bảng tính Excel danh sách trang
│   └── tables.xlsx              # Dữ liệu các bảng HTML dưới dạng Excel
├── markdown/
│   ├── raw/*.md                 # Các file .md thô nguyên bản
│   └── clean/*.md               # Các file .md sạch đã lọc bỏ nav/footer
├── logs/
│   ├── errors.json              # Báo cáo các trang bị lỗi
│   └── crawl-log.txt            # Nhật ký chi tiết tiến trình crawl
├── metadata.json                # Tổng quan thông số job
├── summary.json                 # Thống kê tổng hợp số lượng trang
├── data_quality.json            # Báo cáo điểm chất lượng & cảnh báo
└── diff_report.json             # Báo cáo thay đổi nội dung (Change Detection)
```

### 8.5 Các Gói Xuất Riêng Lẻ (Individual Export Formats)

Ngoài gói ZIP tổng thể (`exportType: "ZIP"`), hệ thống hỗ trợ xuất độc lập từng định dạng:
- **`exportType: "XLSX"`**: Tự động đóng gói thành **`xlsx.zip`** chứa:
  - `pages.xlsx`: Danh sách trang với Page ID, Word Count, Data Quality Score, Content Preview.
  - `tables.xlsx`: Trích xuất toàn bộ bảng HTML thành các Sheet kèm trang `Summary` (có Page ID đối chiếu).
- **`exportType: "CSV"`**: Tự động đóng gói thành **`csv.zip`** chứa: `pages.csv`, `links.csv`, `images.csv`.
- **`exportType: "MARKDOWN"`**: Tự động đóng gói thành **`markdown.zip`** chứa: `clean/*.md` và `raw/*.md`.
- **`exportType: "JSON"`**: Tự động đóng gói thành **`json.zip`** chứa:
  - `pages.json`: Master envelope đầy đủ nhất theo chuẩn Data Contract v1.
  - `clean/pages.clean.json`: Dữ liệu sạch cho AI/LLM Prompt Context.
  - `raw/pages.raw.json`: Dữ liệu thô nguyên bản phục vụ audit.
  - `structured.json`: Dữ liệu có cấu trúc schema.org (nếu có).

Xem chi tiết Data Contract đầy đủ tại [DATA_CONTRACT_V1.md](docs/DATA_CONTRACT_V1.md).
