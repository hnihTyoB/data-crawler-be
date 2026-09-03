# Hướng dẫn Kiểm thử API (Postman & Newman)

Tài liệu này hướng dẫn cách vận hành, cấu trúc và danh sách các kịch bản kiểm thử (test cases) cho hệ thống **Data Crawler Backend API**, bao gồm các luồng xác thực, quản lý crawl job, xem trước dữ liệu Clean/Raw và tải xuống các định dạng file export.

---

## 🚀 1. Cách chạy kiểm thử

### Cách 1: Chạy trực tiếp bằng Postman (GUI)

1. **Import vào Postman**:
   - File Collection: [data-crawler.postman_collection.json](./data-crawler.postman_collection.json)
   - File Environment: [data-crawler.postman_environment.json](./data-crawler.postman_environment.json)
2. **Chọn Environment**: Chọn `Data Crawler Local Environment` ở góc trên bên phải UI Postman.
3. **Chạy Collection Runner**:
   - Click chuột phải vào Collection `Data Crawler BE API` -> Chọn **Run collection**.
   - Chọn các thư mục kịch bản cần kiểm thử (`Auth`, `Crawl Jobs`, `Export & Download`, `Permission & Edge Case Tests`).
   - Nhấn **Run Data Crawler BE API**.

### Cách 2: Chạy tự động bằng Newman (CLI)

Yêu cầu đã khởi chạy Server Backend tại `http://localhost:3000`. Chạy lệnh sau tại thư mục gốc của dự án:

```bash
npx newman run "docs/postman/data-crawler.postman_collection.json" -e "docs/postman/data-crawler.postman_environment.json" --reporters cli
```

Chạy từng folder kịch bản cụ thể:

```bash
npx newman run "docs/postman/data-crawler.postman_collection.json" -e "docs/postman/data-crawler.postman_environment.json" --folder "Crawl Jobs" --reporters cli
```

---

## 📋 2. Chi tiết các Nhóm Kiểm thử (Test Suites)

### 🔐 A. Nhóm Auth (Xác thực & Ủy quyền)

Kiểm tra luồng đăng nhập, lấy thông tin cá nhân, cập nhật tài khoản và cơ chế refresh token.

1. **Login**:
   - _Endpoint_: `POST /auth/login`
   - _Test Assertions_: Trả về HTTP 200, `success: true`, sinh ra `accessToken` và `refreshToken`, tự động lưu vào môi trường Postman (`token`, `refreshToken`).
2. **Get Me**:
   - _Endpoint_: `GET /auth/me`
   - _Test Assertions_: Đính kèm Bearer token. Trả về chính xác thông tin User (`id`, `email`, `role`, `isActive`).
3. **Refresh Token**:
   - _Endpoint_: `POST /auth/refresh`
   - _Test Assertions_: Nhận `refreshToken`, cấp lại `accessToken` mới, cập nhật lại biến môi trường.
4. **Logout**:
   - _Endpoint_: `POST /auth/logout`
   - _Test Assertions_: Thu hồi token trong database, xóa khỏi biến môi trường Postman.
5. **Login with Invalid Credentials (Edge Case)**:
   - _Test Assertions_: Trả về `401 Unauthorized`.
6. **Get Me without Token (Edge Case)**:
   - _Test Assertions_: Trả về `401 Unauthorized`.

---

### ⚙️ B. Nhóm Crawl Jobs & Clean/Raw Preview

Kiểm tra các hoạt động tạo tác vụ crawl, lấy danh sách trang, xem trước dữ liệu sạch/thô và lọc chất lượng.

1. **Create Crawl Job**:
   - _Endpoint_: `POST /crawl-jobs`
   - _Body Payload_: `{ "startUrl": "https://example.com", "mode": "CRAWL", "maxPages": 50, "maxDepth": 2 }`
   - _Test Assertions_: HTTP 201 Created, trả về job ID mới (`job_id`).
2. **Get Crawl Jobs (Paginated & Filtered)**:
   - _Endpoint_: `GET /crawl-jobs?status=PENDING&page=1&limit=10`
   - _Test Assertions_: Trả về danh sách phân trang `{ items: Array, meta: { total, page, limit, totalPages } }`.
3. **Get Crawl Job by ID**:
   - _Endpoint_: `GET /crawl-jobs/:id`
   - _Test Assertions_: Trả về chi tiết các thông số của Job (`startUrl`, `mode`, `status`, `totalPages`, `successPages`, `failedPages`).
4. **Get Crawled Pages (Metadata List)**:
   - _Endpoint_: `GET /crawl-jobs/:id/pages`
   - _Query Params_: Supports `status`, `statusCode`, `search`, `dataQualityScore`, `hasTables`, `hasImages`, `hasLinks`, `wordCount`, `sortBy`, `order`.
   - _Test Assertions_: Trả về mảng danh sách trang kèm theo `normalizedUrl`, `dataQualityScore`, `wordCount`, `warnings`, `hasSensitiveData` (không chứa payload markdown dài để tối ưu băng thông).
5. **Get Crawled Pages Preview (Clean vs. Raw Output)**:
   - _Endpoint_: `GET /crawl-jobs/:id/pages/preview?minQualityScore=50` (hoặc `GET /crawl-jobs/:id/pages?preview=true`)
   - _Test Assertions_:
     - Phải chứa đủ 3 trường nội dung đại diện cho hai lớp Output:
       - `rawMarkdown`: Markdown thô nguyên bản thu thập được.
       - `mainContent`: Thân bài chính đã qua lọc bỏ nhiễu nav/footer/sidebar **(Khuyến nghị cho AI Agents / LLM)**.
       - `cleanText`: Văn bản thuần túy đã xóa sạch ký tự định dạng Markdown.
     - Hỗ trợ kiểm tra các chỉ số chất lượng: `dataQualityScore` (0-100), `wordCount`, `contentHash` (SHA-256), `warnings` (`NAV_NOISE`, `TOO_SHORT`, `DUPLICATE_CONTENT`, ...).
6. **Get Job Assets**:
   - _Endpoint_: `GET /crawl-jobs/:id/assets?assetType=IMAGE`
   - _Query Params_: `assetType` (enum: `IMAGE`, `LINK`, `PDF`, `FILE`, `VIDEO`, `OTHER`).
   - _Test Assertions_: Trả về danh sách tài nguyên hình ảnh/liên kết thu thập được từ các trang.

---

### 💾 C. Nhóm Export & Download

Kiểm tra luồng khởi tạo và tải về các tập tin xuất bản cho Crawl Job đã hoàn thành (`COMPLETED`).

1. **Get Crawl Job Exports**:
   - _Endpoint_: `GET /crawl-jobs/:id/exports`
   - _Test Assertions_: Trả về danh sách các tệp tin xuất bản đã tạo của Job.
2. **Create Export for Job**:
   - _Endpoint_: `POST /crawl-jobs/:id/exports`
   - _Body Payload_: `{ "exportType": "ZIP" }` (Các định dạng hỗ trợ: `JSON`, `CSV`, `XLSX`, `MARKDOWN`, `ZIP`).
   - _Test Assertions_: HTTP 201 Created, khởi tạo bản export thành công và lưu `export_id`.
3. **Download Export File**:
   - _Endpoint_: `GET /exports/:exportId/download` (hoặc `GET /crawl-jobs/:id/download`)
   - _Test Assertions_: Trả về stream binary tệp tin kèm theo đúng Header `Content-Disposition`.
   - **Đặc quyền cấu trúc ZIP Output**:
     - Thư mục `/data/raw/pages.raw.json` & `/data/clean/pages.clean.json`.
     - Thư mục `/markdown/raw/` & `/markdown/clean/`.
     - Các tệp `tables.xlsx`, `links.csv`, `images.csv`, `metadata.json`, `errors.json`.

---

### 🛡️ D. Nhóm Permission & Edge Case Tests (Phân quyền & Lỗi nghiệp vụ)

1. **Get Non-Existent Job**:
   - Gửi ID UUID không tồn tại -> Kiểm tra phản hồi `404 Not Found` và `code: "CRAWL_JOB_NOT_FOUND"`.
2. **Cancel Completed Job**:
   - Cố gắng hủy một job đã ở trạng thái `COMPLETED` -> Phản hồi `400 Bad Request`.
3. **Owner vs Admin Authorization**:
   - Đảm bảo User thường không thể truy cập hoặc thao tác trên Crawl Job của người dùng khác (Hệ thống trả về `404 Not Found` để ẩn sự tồn tại của resource).
   - Đảm bảo tài khoản ADMIN xem và quản lý được toàn bộ Job trong hệ thống.
