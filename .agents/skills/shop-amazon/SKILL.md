---
name: shop-amazon
description: "Quy trình chuẩn để thu thập, bóc tách dữ liệu sản phẩm có cấu trúc từ sàn Amazon sử dụng Firecrawl và template extraction"
---

# Skill: Thu Thập & Bóc Tách Sản Phẩm Amazon (shop-amazon)

Quy trình chuẩn dành cho Antigravity để tự động cấu hình và kích hoạt tác vụ cào dữ liệu sản phẩm từ sàn thương mại điện tử Amazon trong `data-crawler-be`.

---

## 1. Mục Đích & Phạm Vi Áp Dụng

- Dùng khi cần cào danh sách sản phẩm hoặc thông tin chi tiết một sản phẩm trên Amazon (`amazon.com`, `amazon.co.jp`, v.v.).
- Bóc tách các trường: Tiêu đề (`title`), Giá bán (`price`), Đánh giá (`rating`), Số lượng đánh giá (`reviewCount`), Ảnh sản phẩm (`mainImage`), Tình trạng (`availability`).

---

## 2. Cấu Hình Job Đề Xuất (Payload Mẫu)

Gửi yêu cầu tới `POST /api/v1/crawl-jobs`:

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

> **Quy tắc chống chặn (Anti-bot):**
>
> - Amazon áp dụng cơ chế phát hiện bot rất mạnh. Luôn đặt `delayMs >= 2000`ms.
> - Đảm bảo worker bắt cờ `CAPTCHA_DETECTED` hoặc `BLOCKED` trong bảng `crawl_pages` để cảnh báo kịp thời.

---

## 3. Extraction Template Cho Amazon

Định nghĩa template trích xuất có cấu trúc cho domain `amazon.com`:

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

## 4. Xuất Dữ Liệu Sau Khi Cào

Sau khi Job đạt trạng thái `COMPLETED`:

- Kích hoạt export sang Excel qua `POST /api/v1/exports` với `exportType: "XLSX"`.
- Báo cáo kết quả và đường dẫn tải file xuất cho người dùng.
