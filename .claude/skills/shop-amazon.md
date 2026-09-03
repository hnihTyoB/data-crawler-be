# Tác Vụ Tái Sử Dụng: Cào & Bóc Tách Dữ Liệu Sản Phẩm Amazon (shop-amazon.md)

> Skill workflow định nghĩa quy trình chuẩn để thu thập và trích xuất dữ liệu sản phẩm có cấu trúc từ sàn thương mại điện tử Amazon sử dụng hệ thống `data-crawler-be`.

---

## 1. Thông Tin Tác Vụ (Task Metadata)

- **Mục tiêu:** Thu thập thông tin danh sách sản phẩm hoặc chi tiết sản phẩm Amazon (Tiêu đề, Giá bán, Đánh giá sao, Số lượng review, Ảnh đại diện, ASIN, Tình trạng còn hàng).
- **Target Domain:** `amazon.com`, `amazon.co.jp`, `amazon.de`, ...
- **Chế độ khuyến nghị:** `CRAWL` (cho trang danh mục) hoặc `SCRAPE` (cho từng sản phẩm cụ thể).

---

## 2. Cấu Hình Job Đề Xuất (Job Parameters)

Khi khởi tạo `CrawlJob` qua API `POST /api/v1/crawl-jobs`, sử dụng payload mẫu sau:

```json
{
  "startUrl": "https://www.amazon.com/s?k=laptop",
  "mode": "CRAWL",
  "maxPages": 25,
  "maxDepth": 2,
  "delayMs": 2500,
  "timeoutMs": 45000,
  "retryCount": 3,
  "respectRobotsTxt": true,
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}
```

> **Lưu ý chống chặn (Anti-bot):**
> - Luôn thiết lập `delayMs` tối thiểu `2000`ms để tránh bị hệ thống Amazon chặn IP hoặc hiển thị CAPTCHA.
> - Đảm bảo worker bắt cờ `CAPTCHA_DETECTED` và `BLOCKED` trong bảng `crawl_pages` để cảnh báo người dùng.

---

## 3. Extraction Template Cho Amazon (Bóc Tách Dữ Liệu)

Áp dụng template trích xuất có cấu trúc tương ứng với domain `amazon.com`:

```json
{
  "domain": "amazon.com",
  "name": "Amazon Product Standard Template",
  "fields": [
    {
      "name": "title",
      "selector": "#productTitle, h2 a.a-link-normal span",
      "type": "text",
      "required": true
    },
    {
      "name": "price",
      "selector": ".a-price .a-offscreen, span.a-price-whole",
      "type": "text",
      "required": false
    },
    {
      "name": "rating",
      "selector": "span[data-hook='rating-out-of-text'], span.a-icon-alt",
      "type": "text",
      "required": false
    },
    {
      "name": "reviewCount",
      "selector": "#acrCustomerReviewText, span[data-hook='total-review-count']",
      "type": "number",
      "required": false
    },
    {
      "name": "mainImage",
      "selector": "#landingImage, .s-image",
      "type": "attribute",
      "attributeName": "src",
      "required": false
    },
    {
      "name": "availability",
      "selector": "#availability span",
      "type": "text",
      "required": false
    }
  ]
}
```

---

## 4. Quy Trình Xuất Báo Cáo Kết Quả

1. Sau khi Job chuyển trạng thái `COMPLETED`:
2. Gọi API `POST /api/v1/exports` với:
   ```json
   {
     "jobId": "<crawl-job-id>",
     "exportType": "XLSX"
   }
   ```
3. File Excel sinh ra sẽ có cột phân tách rõ ràng cho từng thuộc tính sản phẩm, sẵn sàng phân tích hoặc nhập liệu.
