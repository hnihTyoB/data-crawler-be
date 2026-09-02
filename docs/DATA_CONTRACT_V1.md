# Data Contract v1 - Standardized Crawl Output Schema

Tài liệu này định nghĩa chuẩn mực giao tiếp dữ liệu (Data Contract v1) cho toàn bộ dữ liệu đầu ra được thu thập bởi hệ thống **Data Crawler Backend**. Các định dạng xuất file (JSON, CSV, XLSX, Markdown, ZIP) và các API Preview đều tuân thủ Data Contract này nhằm đảm bảo tính ổn định và nhất quán cho cả ứng dụng **Frontend (FE)** lẫn các **AI Agents / LLM Pipelines** tiêu thụ dữ liệu.

---

## 1. Tổng quan Kiến trúc Dữ liệu Output (Clean vs. Raw Output Model)

Hệ thống phân tách rõ ràng hai lớp nội dung dữ liệu để tối ưu cho các mục đích sử dụng khác nhau:

```
                  ┌─────────────────────────────────────────┐
                  │          Crawler Engine Output          │
                  └────────────────────┬────────────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
            ┌─────────────────────────┐ ┌─────────────────────────┐
            │       RAW OUTPUT        │ │      CLEAN OUTPUT       │
            │   (Original Markdown)   │ │  (Main Body & Text Only)│
            └────────────┬────────────┘ └────────────┬────────────┘
                         │                           │
          • Phục vụ Debug / Audit     • mainContent: Đã lọc Nav/Footer/Noise
          • Render nguyên bản gốc     • cleanText: Strip toàn bộ Markdown
          • File: pages.raw.json      • Phục vụ AI LLM / RAG / Ingestion
          • Folder: markdown/raw/     • File: pages.clean.json
                                      • Folder: markdown/clean/
```

### 1.1 Raw Output (Dữ liệu thô)

- **Trường chính**: `rawMarkdown`
- **Đặc điểm**: Giữ nguyên nội dung Markdown gốc thu thập được từ website, bao gồm cả các thanh điều hướng, menu, sidebar, liên kết mạng xã hội và chân trang.
- **Mục đích sử dụng**: Phục vụ mục đích kiểm tra, gỡ lỗi hoặc khi Frontend muốn tái hiện lại cấu trúc trang gốc.

### 1.2 Clean Output (Dữ liệu sạch & Tối ưu hóa)

- **Trường chính**: `mainContent` và `cleanText`
- **Đặc điểm**:
  - **`mainContent`**: Đã qua thuật toán lọc nhiễu tự động (`extractMainContent`). Loại bỏ các khối menu lặp lại, thanh điều hướng, các section sidebar quảng cáo/bài viết liên quan và copyright footer. Vẫn giữ lại cấu trúc cú pháp Markdown (bảng, tiêu đề, danh sách, link chính) để giữ tính ngữ nghĩa. **Đây là trường được khuyến nghị hàng đầu cho AI Agent, LLM Prompt Context & RAG Indexing.**
  - **`cleanText`**: Đã loại bỏ toàn bộ ký tự định dạng Markdown (`stripMarkdown`), chỉ còn văn bản thuần túy. Dùng để tính toán độ dài từ (`wordCount`), tạo mã hash nội dung (`contentHash`) và chấm điểm chất lượng.
- **Mục đích sử dụng**: Nạp dữ liệu vào AI Agent, huấn luyện mô hình LLM, tìm kiếm ngữ nghĩa (Vector Search / RAG).

---

## 2. Cấu trúc Chuẩn: pages.json Envelope

`pages.json` là định dạng export cốt lõi của hệ thống. File chứa một đối tượng bao ngoài kèm theo thông tin phiên bản schema và danh sách các bản ghi `CrawlPageRecord`.

### 2.1 Cấu trúc JSON Envelope

```json
{
  "schemaVersion": "1.0.0",
  "jobId": "c4b8e21a-4d3f-4e89-9a1b-2c3d4e5f6a7b",
  "totalRecords": 2,
  "exportedAt": "2026-07-21T13:30:00.000Z",
  "pages": [
    {
      "id": "e8a12345-6789-4abc-def0-123456789abc",
      "jobId": "c4b8e21a-4d3f-4e89-9a1b-2c3d4e5f6a7b",
      "url": "https://example.com/blog/article-1?utm_source=facebook#section-2",
      "normalizedUrl": "https://example.com/blog/article-1",
      "title": "Hướng dẫn Crawl Dữ liệu Web",
      "description": "Bài viết hướng dẫn chi tiết cách crawl dữ liệu chuẩn hóa.",
      "status": "SUCCESS",
      "statusCode": 200,
      "errorMessage": null,
      "rawMarkdown": "# Hướng dẫn Crawl\n\n* [Home](https://example.com)\n\nNội dung chính bài viết...\n\n© 2026 Example Inc.",
      "cleanText": "Hướng dẫn Crawl Nội dung chính bài viết...",
      "mainContent": "# Hướng dẫn Crawl\n\nNội dung chính bài viết...",
      "wordCount": 150,
      "contentHash": "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
      "dataQualityScore": 100,
      "warnings": [],
      "links": [
        {
          "url": "https://example.com/docs",
          "sourceUrl": "https://example.com/blog/article-1",
          "type": "internal"
        },
        {
          "url": "https://external-site.org",
          "sourceUrl": "https://example.com/blog/article-1",
          "type": "external"
        }
      ],
      "images": [
        {
          "sourceUrl": "https://example.com/images/architecture.png",
          "altText": "Sơ đồ kiến trúc",
          "orderIndex": 1,
          "type": "png"
        }
      ],
      "tables": [
        {
          "tableIndex": 0,
          "headers": ["STT", "Tên Thuộc Tính", "Mô Tả"],
          "rowsCount": 5,
          "colsCount": 3,
          "sheetName": "Table-Pblog_article-1-0"
        }
      ],
      "crawledAt": "2026-07-21T13:25:00.000Z"
    }
  ]
}
```

---

## 3. Định nghĩa Chi tiết các Trường (Field Specifications)

### 3.1 Định danh & Chuẩn hóa (Identity & Normalization)

- **`id`** (`string (UUID)`, Required): Định danh duy nhất của trang trong database.
- **`jobId`** (`string (UUID)`, Required): ID của Crawl Job thực hiện crawl trang này.
- **`url`** (`string (URI)`, Required): URL gốc mà crawler đã yêu cầu truy cập.
- **`normalizedUrl`** (`string (URI)`, Required): URL đã qua thuật toán chuẩn hóa:
  1. Chuyển `scheme` và `hostname` về chữ thường (lowercase).
  2. Loại bỏ các tham số tracking phổ biến (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`).
  3. Sắp xếp lại query parameters theo thứ tự bảng chữ cái.
  4. Loại bỏ fragment phần hash (`#...`) và trailing slash cuối đường dẫn.
  5. Dùng để deduplicate và so sánh trùng lặp trang.

### 3.2 Metadata Trang

- **`title`** (`string | null`): Tiêu đề trang trích xuất từ thẻ `<title>` hoặc thẻ Open Graph `og:title`.
- **`description`** (`string | null`): Mô tả ngắn từ thẻ `<meta name="description">` hoặc `og:description`.

### 3.3 Trạng thái Crawl & Lỗi (Status & Error Details)

- **`status`** (`enum string`, Required): Trạng thái crawl của trang.
  - Chi tiết danh mục Enum:
    - `PENDING`: Trang đang nằm trong hàng đợi crawl.
    - `SUCCESS`: Crawl nội dung thành công.
    - `FAILED`: Crawl thất bại do lỗi kết nối/server.
    - `BLOCKED`: Trang bị chặn truy cập (HTTP 403 Forbidden hoặc bị Cloudflare/WAF chặn).
    - `TIMEOUT`: Quá thời hạn phản hồi (`timeoutMs`).
    - `CAPTCHA_DETECTED`: Phát hiện bài toán xác minh Captcha.
    - `PAYWALL_DETECTED`: Nội dung yêu cầu trả phí.
    - `REQUIRES_LOGIN`: Yêu cầu đăng nhập tài khoản.
    - `SKIPPED`: Trang bị bỏ qua theo cấu hình (ví dụ `respectRobotsTxt` hoặc giới hạn `maxPages`).
- **`statusCode`** (`number | null`): Mã trạng thái HTTP trả về từ server đích (ví dụ: `200`, `404`, `500`).
- **`errorMessage`** (`string | null`): Thông báo chi tiết nếu `status !== 'SUCCESS'`.

### 3.4 Nội dung Trang (Content Fields)

- **`rawMarkdown`** (`string | null`): Dữ liệu Markdown thô nguyên bản từ crawler engine.
- **`cleanText`** (`string | null`): Plain text thuần túy đã xóa sạch toàn bộ ký tự định dạng Markdown.
- **`mainContent`** (`string | null`): Thân bài chính của trang sau khi đã bóc tách bớt nhiễu (menu, nav, footer, copyright, sidebar). **Trường ưu tiên cho AI Agent / LLM.**

### 3.5 Chỉ số Chất lượng & Cảnh báo (Quality & Warnings)

- **`wordCount`** (`number`, Required): Tổng số từ tính trên `cleanText`.
- **`contentHash`** (`string (SHA-256) | null`): Mã hash SHA-256 tạo từ `cleanText` nhằm phát hiện bài viết trùng lặp nội dung.
- **`dataQualityScore`** (`number (0-100) | null`): Thang điểm chất lượng dữ liệu trang (null nếu status không phải `SUCCESS`).
  - **Công thức tính điểm (Tổng 100 điểm)**:
    - Có `mainContent` hợp lệ: **+40 điểm**
    - `wordCount` >= 100 từ: **+30 điểm**
    - Có `title` hợp lệ: **+15 điểm**
    - Có `description` hợp lệ: **+15 điểm**
- **`warnings`** (`array of strings`, Required): Danh sách mã cảnh báo chất lượng dữ liệu:
  - `NAV_NOISE`: Mật độ menu điều hướng quá lớn so với nội dung thực.
  - `TOO_SHORT`: Nội dung quá ngắn (`wordCount < 100`).
  - `DUPLICATE_CONTENT`: Mã `contentHash` trùng với một trang khác đã crawl trong cùng Job.
  - `MISSING_TITLE`: Trang thiếu thẻ tiêu đề `<title>`.
  - `MISSING_DESCRIPTION`: Trang thiếu meta description.
  - `LOW_QUALITY_SCORE`: Điểm `dataQualityScore < 60`.

### 3.6 Bộ sưu tập Asset & Bảng (Assets & Tables)

- **`links`** (`array of LinkRecord`, Required):
  - `url` (`string`): Absolute URL của liên kết đích.
  - `sourceUrl` (`string`): URL trang chứa liên kết này.
  - `type` (`'internal' | 'external'`): Phân loại link nội bộ (cùng domain với job) hay ngoại bộ.
- **`images`** (`array of ImageRecord`, Required):
  - `sourceUrl` (`string`): URL nguồn của hình ảnh.
  - `altText` (`string | null`): Văn bản thay thế của ảnh (`alt`).
  - `orderIndex` (`number`): Thứ tự xuất hiện của ảnh trong trang (1-based).
  - `type` (`string`): Định dạng/MIME type của ảnh (ví dụ: `png`, `jpg`, `webp`, `svg`).
- **`tables`** (`array of TableRecord`, Required):
  - `tableIndex` (`number`): Vị trí chỉ mục của bảng trong trang (0-based).
  - `headers` (`array of strings`): Danh sách tên cột trích xuất từ thẻ `<th>`.
  - `rowsCount` (`number`): Số lượng hàng dữ liệu.
  - `colsCount` (`number`): Số lượng cột.
  - `sheetName` (`string`): Tên worksheet tương ứng chứa bảng này trong file `tables.xlsx`.

### 3.7 Thời gian (Timestamps)

- **`crawledAt`** (`string (ISO 8601) | null`): Thời điểm hoàn thành crawl trang (VD: `2026-07-21T13:25:00.000Z`).

---

## 4. Chi tiết các File Output Export

Khi người dùng khởi tạo yêu cầu xuất dữ liệu (`POST /crawl-jobs/:id/exports`), hệ thống hỗ trợ các định dạng sau:

### 4.1 `pages.json`

Chứa Envelope tổng thể như đã trình bày ở Mục 2.

### 4.2 `links.csv`

Chứa tất cả các liên kết thu thập được từ toàn bộ các trang trong job.

- **Headers**: `pageId,sourceUrl,url,type`

### 4.3 `images.csv`

Chứa thông tin tất cả hình ảnh thu thập được trong job.

- **Headers**: `pageId,sourceUrl,altText,orderIndex,type`

### 4.4 `tables.xlsx`

File bảng tính Excel tổng hợp toàn bộ các bảng HTML được phát hiện trong các trang:

- **Sheet "Summary"**: Tổng hợp danh sách các bảng, URL trang chứa, số hàng, số cột và tên worksheet chi tiết.
- **Các Sheet "Table-P<ShortPath>-<Index>"**: Chứa dữ liệu chi tiết dạng lưới ô (cells) của từng bảng.

### 4.5 `pages.xlsx`

File Excel bảng tính dành cho người dùng xem nhanh danh sách các trang đã crawl, trạng thái, mã HTTP, tiêu đề, mô tả, điểm chất lượng và số từ.

### 4.6 `metadata.json`

Tóm tắt tổng quan tiến trình chạy của Crawl Job:

```json
{
  "jobId": "c4b8e21a-4d3f-4e89-9a1b-2c3d4e5f6a7b",
  "userId": "9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "startUrl": "https://example.com",
  "domain": "example.com",
  "mode": "CRAWL",
  "status": "COMPLETED",
  "maxPages": 100,
  "maxDepth": 3,
  "totalPages": 50,
  "successPages": 48,
  "failedPages": 2,
  "timeoutMs": 30000,
  "retryCount": 3,
  "startedAt": "2026-07-21T13:20:00.000Z",
  "finishedAt": "2026-07-21T13:28:00.000Z",
  "exportedAt": "2026-07-21T13:30:00.000Z"
}
```

### 4.7 `errors.json`

Báo cáo riêng các trang bị lỗi (`status !== 'SUCCESS'`):

```json
[
  {
    "url": "https://example.com/protected-page",
    "status": "REQUIRES_LOGIN",
    "statusCode": 401,
    "errorMessage": "Page requires authentication credentials",
    "crawledAt": "2026-07-21T13:26:00.000Z"
  }
]
```

### 4.8 Cấu trúc File ZIP Export (`exportType: "ZIP"`)

Khi chọn export định dạng `ZIP`, gói lưu trữ sẽ tự động cấu trúc phân cấp dữ liệu clean/raw thành các thư mục riêng biệt:

```
export-job-c4b8e21a.zip
├── data/
│   ├── raw/
│   │   └── pages.raw.json      # Danh sách trang thô (chứa rawMarkdown)
│   └── clean/
│       └── pages.clean.json    # Danh sách trang sạch (chứa mainContent & cleanText)
├── markdown/
│   ├── raw/
│   │   ├── page-1.md           # Tệp markdown thô nguyên bản của từng trang
│   │   └── page-2.md
│   └── clean/
│       ├── page-1.md           # Tệp markdown sạch đã lọc nav/footer
│       └── page-2.md
├── tables.xlsx                 # Bảng tính chứa dữ liệu các HTML tables
├── links.csv                   # Danh sách liên kết nội/ngoại bộ
├── images.csv                  # Danh sách thông tin hình ảnh
├── metadata.json               # Tổng quan thông số job
└── errors.json                 # Nhật ký lỗi trang thất bại
```

---

## 5. Hướng dẫn Tích hợp dành cho FE & AI Agents

### 5.1 Dành cho Developers Frontend (FE)

- **Danh sách phân trang gọn nhẹ**: Gọi `GET /api/v1/crawl-jobs/:id/pages`. Mặc định API sẽ không trả về `markdownContent` hay `content` dài để tránh gây nặng payload mạng.
- **Xem trước nội dung (Preview)**: Khi người dùng bấm xem chi tiết trang hoặc muốn xem dữ liệu clean/raw, gọi `GET /api/v1/crawl-jobs/:id/pages/preview` (hoặc thêm query `preview=true`).
- **Lọc theo chất lượng**: FE có thể dùng các tham số query `minQualityScore=70`, `hasTables=true`, `status=SUCCESS`, `search=keyword` để hiển thị bộ lọc thông minh cho người dùng.

### 5.2 Dành cho AI Agents / LLM Integration

- **Trường dữ liệu ưu tiên**: AI Agent **chỉ nên nạp trường `mainContent`** làm context window cho LLM. Trường này đã được tối ưu hóa loại bỏ menu/footer nhiễu, giúp giảm 30%-60% số lượng token thừa và tránh làm loãng ngữ nghĩa.
- **Deduplication & RAG Indexing**: Sử dụng mã `contentHash` (SHA-256) để kiểm tra trùng lặp trước khi ghi vào Vector Database (Chroma, Pinecone, Qdrant). Bỏ qua các bản ghi có cảnh báo `DUPLICATE_CONTENT` hoặc `dataQualityScore < 50`.
- **Ingestion hàng loạt**: Tải file ZIP export và đọc trực tiếp file `/data/clean/pages.clean.json` hoặc các tệp `.md` trong thư mục `/markdown/clean/`.
