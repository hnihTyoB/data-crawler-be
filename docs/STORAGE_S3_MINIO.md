# Storage export: Local, AWS S3 và MinIO

## 1. Cách hệ thống đang hoạt động

Storage được chọn bằng `STORAGE_DRIVER`:

| Cấu hình               | Nơi lưu file                                   |
| ---------------------- | ---------------------------------------------- |
| `STORAGE_DRIVER=local` | Lưu trực tiếp trong `STORAGE_EXPORT_DIR`       |
| `STORAGE_DRIVER=s3`    | Dùng AWS S3, MinIO hoặc dịch vụ tương thích S3 |

Với JSON, CSV, XLSX và Markdown, hệ thống tạo file staging rồi upload lên storage. ZIP được stream trực tiếp lên storage, không tạo file ZIP local.

Database lưu storage path, ví dụ:

```text
<jobId>/data/pages.json
<jobId>/<jobId>.zip
```

Khi download, backend đọc file từ storage provider đang được cấu hình.

## 2. Chạy local với MinIO

Khởi động các service:

```bash
docker compose up -d redis minio
```

Lệnh trên dùng database đã deploy theo cấu hình `DB_HOST` trong `.env`. Chỉ khởi động thêm `postgres` nếu muốn chạy database local:

```bash
docker compose up -d postgres redis minio
```

Nếu đã có Redis online và `REDIS_HOST` trỏ tới Redis đó, chỉ cần khởi động MinIO:

```bash
docker compose up -d minio
```

Mở MinIO Console tại `http://127.0.0.1:9001`:

```text
Username: minioadmin
Password: minioadmin
```

Tạo bucket `data-crawler-exports` một lần.

Cấu hình `.env`:

```env
STORAGE_DRIVER=s3
STORAGE_EXPORT_DIR=storage/exports
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=data-crawler-exports
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
```

Chạy API và worker ở hai terminal:

```bash
pnpm dev
```

```bash
pnpm worker
```

Swagger: `http://127.0.0.1:3000/api-docs`

Nếu backend chạy trong Docker cùng MinIO, dùng:

```env
S3_ENDPOINT=http://minio:9000
```

## 3. Triển khai online với AWS S3

Tạo private S3 bucket và cấp IAM Role hoặc credentials cho backend. API và worker phải dùng cùng cấu hình:

```env
STORAGE_DRIVER=s3
STORAGE_EXPORT_DIR=/tmp/data-crawler-exports
S3_ENDPOINT=
S3_REGION=ap-southeast-1
S3_BUCKET=your-production-bucket
S3_FORCE_PATH_STYLE=false
```

Nếu chạy trên AWS, nên dùng IAM Role và không đặt access key trực tiếp. Nếu deploy ngoài AWS, lưu credentials trong secret manager.

## 4. Triển khai online với MinIO

MinIO phải chạy như một service riêng có persistent volume, HTTPS, backup và restart policy.

```env
STORAGE_DRIVER=s3
STORAGE_EXPORT_DIR=/tmp/data-crawler-exports
S3_ENDPOINT=https://minio.example.com
S3_REGION=us-east-1
S3_BUCKET=data-crawler-exports
S3_ACCESS_KEY_ID=backend-app-key
S3_SECRET_ACCESS_KEY=backend-app-secret
S3_FORCE_PATH_STYLE=true
```

Không dùng `minioadmin/minioadmin` hoặc image tag `latest` trên production. Với dữ liệu quan trọng, dùng MinIO distributed hoặc managed storage như AWS S3.

## 5. Build và chạy production

```bash
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm db:migrate:deploy
pnpm build
pnpm start
```

Chạy worker từ code đã build:

```bash
node dist/queues/crawl.worker.js
```

## 6. Checklist

- API và worker dùng cùng storage config và bucket.
- Bucket đã tồn tại và không public.
- Credentials nằm trong secret manager.
- `STORAGE_EXPORT_DIR` writable và có cleanup định kỳ.
- MinIO production có persistent volume, HTTPS và backup.
- Database migrations đã được apply.
- API và worker có restart policy.

Lưu ý: AWS S3 và MinIO không được chọn theo kích thước file. Provider chỉ phụ thuộc cấu hình môi trường khi process khởi động.
