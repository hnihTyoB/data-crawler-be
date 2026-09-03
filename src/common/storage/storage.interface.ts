import { Readable } from "stream";

export interface UploadResult {
  fileName: string;
  filePath: string;
  url?: string;
  sizeBytes?: number;
}

export interface UploadStreamOptions {
  contentType?: string;
  contentLength?: number;
}

export interface IStorageService {
  /**
   * Upload tệp tin từ đĩa cục bộ lên Storage (Local hoặc S3/MinIO)
   */
  uploadFile(
    localFilePath: string,
    destinationKey: string,
  ): Promise<UploadResult>;

  /**
   * Stream directly to storage with backpressure. Implementations must not
   * collect the complete source in memory.
   */
  uploadStream(
    destinationKey: string,
    source: Readable,
    options?: UploadStreamOptions,
  ): Promise<UploadResult>;

  /**
   * Tải tệp tin từ Storage về đĩa cục bộ
   */
  downloadFile(
    destinationKey: string,
    localDestinationPath: string,
  ): Promise<string>;

  /**
   * Lấy Read Stream của tệp tin từ Storage (dành cho streaming export / download)
   */
  getReadStream(destinationKey: string): Promise<Readable>;

  /**
   * Xóa tệp tin trên Storage
   */
  deleteFile(destinationKey: string): Promise<void>;

  /**
   * Kiểm tra sự tồn tại của tệp tin trên Storage
   */
  exists(destinationKey: string): Promise<boolean>;
}
