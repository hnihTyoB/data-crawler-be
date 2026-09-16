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

### 4.2 `pages.csv`

File bảng CSV tổng hợp danh sách các trang đã thu thập, tối ưu cho việc mở xem nhanh bằng Excel / Google Sheets hoặc nhập liệu vào database:

- **Headers**: `pageId,url,title,description,status,statusCode,errorMessage,wordCount,dataQualityScore,mainContent,crawledAt`
- Cột `pageId` là khóa ngoại (foreign key) map trực tiếp với `links.csv` và `images.csv`.
- Nội dung văn bản chỉ giữ trường sạch `mainContent` để tránh phình dung lượng và tránh lỗi giới hạn ký tự ô của Excel (32,767 ký tự).

### 4.3 `links.csv`

Chứa tất cả các liên kết thu thập được từ toàn bộ các trang trong job.

- **Headers**: `pageId,sourceUrl,url,type`

### 4.4 `images.csv`

Chứa thông tin tất cả hình ảnh thu thập được trong job.

- **Headers**: `pageId,sourceUrl,altText,orderIndex,type`

### 4.5 `tables.xlsx` & `pages.xlsx`

- **`tables.xlsx`**: File bảng tính Excel tổng hợp toàn bộ các bảng HTML được phát hiện trong các trang (Sheet "Summary" và các sheet chi tiết của từng bảng).
- **`pages.xlsx`**: File bảng tính Excel dành cho người dùng xem nhanh danh sách các trang đã crawl kèm định dạng màu trạng thái.

### 4.6 `metadata.json`, `summary.json`, `data_quality.json`, `diff_report.json`

- **`metadata.json`**: Tóm tắt tổng quan thông số và cấu hình chạy của Crawl Job.
- **`summary.json`**: Thống kê số lượng trang thành công/thất bại và thời gian hoàn thành.
- **`data_quality.json`**: Báo cáo tổng hợp điểm chất lượng dữ liệu, tỷ lệ nội dung sạch, các cảnh báo (nav noise, trùng lặp, bài viết quá ngắn).
- **`diff_report.json`**: Báo cáo phát hiện thay đổi nội dung (Change Detection) giữa các lần crawl.

### 4.7 `logs/errors.json` & `logs/crawl-log.txt`

- **`errors.json`**: Báo cáo riêng các trang bị lỗi (`status !== 'SUCCESS'`) kèm mã lỗi và nguyên nhân chi tiết.
- **`crawl-log.txt`**: Toàn bộ nhật ký chạy tiến trình crawl.

### 4.8 Gói Xuất CSV Riêng Lẻ (`exportType: "CSV"`)

Khi chọn xuất định dạng `CSV`, hệ thống tự động đóng gói toàn bộ các bảng CSV thành tệp **`csv.zip`** chứa:
- `pages.csv`: Bảng tổng hợp trang kèm chỉ số chất lượng và ID.
- `links.csv`: Bảng liên kết nội/ngoại bộ.
- `images.csv`: Bảng danh sách hình ảnh trích xuất.

### 4.9 Gói Xuất Markdown Riêng Lẻ (`exportType: "MARKDOWN"`)

Hệ thống đóng gói toàn bộ tài liệu Markdown thành **`markdown.zip`** gồm 2 thư mục:
- `clean/*.md`: File Markdown sạch đã bóc tách nav/footer dành cho AI Prompt Context.
- `raw/*.md`: File Markdown thô nguyên bản phục vụ kiểm tra/đối chiếu.

### 4.10 Gói Xuất XLSX Riêng Lẻ (`exportType: "XLSX"`)

Khi chọn xuất định dạng `XLSX`, hệ thống tự động đóng gói toàn bộ bảng tính Excel vào tệp **`xlsx.zip`** chứa:
- `pages.xlsx`: Danh sách toàn bộ các trang crawl kèm Page ID, Word Count, Data Quality Score, Content Preview và metadata.
- `tables.xlsx`: Tập hợp toàn bộ bảng HTML trích xuất được từ website, bao gồm trang `Summary` (liệt kê danh sách bảng kèm Page ID và URL để đối chiếu chéo) và từng Sheet cho từng bảng dữ liệu riêng biệt.

### 4.11 Gói Xuất JSON Riêng Lẻ (`exportType: "JSON"`)

Khi chọn xuất định dạng `JSON`, hệ thống tự động đóng gói toàn bộ các file JSON dữ liệu vào tệp **`json.zip`** chứa:
- `pages.json`: Master Envelope đầy đủ nhất theo chuẩn Data Contract v1.
- `clean/pages.clean.json`: Dữ liệu sạch đã lọc bỏ `rawMarkdown`, tối ưu hóa token cho AI Prompt Context và RAG Indexing.
- `raw/pages.raw.json`: Dữ liệu thô nguyên bản phục vụ audit / debug.
- `structured.json`: Dữ liệu có cấu trúc (schema.org JSON-LD / OpenGraph), chỉ xuất hiện khi có ít nhất một trang có dữ liệu này.

### 4.12 Cấu trúc File ZIP Xuất Toàn Bộ (`exportType: "ZIP"`)

Khi chọn export định dạng `ZIP`, gói lưu trữ chứa toàn bộ dữ liệu phân cấp theo đúng cấu trúc tiêu chuẩn:

```
export-job-c4b8e21a.zip
├── data/
│   ├── raw/
│   │   └── pages.raw.json      # Danh sách trang thô (chứa rawMarkdown)
│   ├── clean/
│   │   └── pages.clean.json    # Danh sách trang sạch (chứa mainContent & cleanText)
│   ├── pages.json              # Dữ liệu Envelope đầy đủ
│   ├── structured.json         # Dữ liệu trích xuất có cấu trúc
│   ├── pages.csv               # Bảng CSV danh sách trang kèm chỉ số chất lượng
│   ├── links.csv               # Danh sách liên kết nội/ngoại bộ (CSV)
│   ├── images.csv              # Danh sách hình ảnh (CSV)
│   ├── pages.xlsx              # Bảng tính Excel danh sách trang
│   └── tables.xlsx             # Bảng tính Excel chi tiết các HTML tables
├── markdown/
│   ├── raw/
│   │   ├── page-1.md           # Tệp markdown thô nguyên bản của từng trang
│   │   └── page-2.md
│   └── clean/
│       ├── page-1.md           # Tệp markdown sạch đã lọc nav/footer
│       └── page-2.md
├── logs/
│   ├── errors.json             # Nhật ký lỗi các trang thất bại
│   └── crawl-log.txt           # Nhật ký tiến trình crawl
├── metadata.json               # Tổng quan thông số job
├── summary.json                # Thống kê tổng hợp kết quả
├── data_quality.json           # Báo cáo điểm chất lượng & cảnh báo
└── diff_report.json            # Báo cáo thay đổi nội dung (nếu có)
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
