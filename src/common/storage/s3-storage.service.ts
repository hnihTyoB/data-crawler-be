import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  IStorageService,
  UploadResult,
  UploadStreamOptions,
} from './storage.interface';
import { storageConfig } from '../../config/storage.config';
import { ensureDirExists, getFileSizeBytes } from '../helpers/file.helper';

export class S3StorageService implements IStorageService {
  private readonly config = storageConfig.s3;
  private readonly client: S3Client;

  constructor(client?: S3Client) {
    this.client =
      client ??
      new S3Client({
        region: this.config.region,
        endpoint: this.config.endpoint || undefined,
        forcePathStyle: this.config.forcePathStyle,
        credentials:
          this.config.accessKeyId && this.config.secretAccessKey
            ? {
                accessKeyId: this.config.accessKeyId,
                secretAccessKey: this.config.secretAccessKey,
              }
            : undefined,
        // Avoid optional checksum headers that older MinIO versions reject.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }

  async uploadFile(
    localFilePath: string,
    destinationKey: string,
  ): Promise<UploadResult> {
    const sizeBytes = getFileSizeBytes(localFilePath);
    return this.uploadStream(
      destinationKey,
      fs.createReadStream(localFilePath),
      { contentLength: sizeBytes },
    );
  }

  async uploadStream(
    destinationKey: string,
    source: Readable,
    options: UploadStreamOptions = {},
  ): Promise<UploadResult> {
    const key = this.normalizeKey(destinationKey);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.config.bucket,
        Key: key,
        Body: source,
        ContentType: options.contentType,
        ContentLength: options.contentLength,
      },
      // Keep memory bounded while still allowing multipart throughput.
      queueSize: 2,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
    });

    await upload.done();

    return {
      fileName: path.posix.basename(key),
      filePath: key,
      url: this.buildObjectUrl(key),
      sizeBytes: options.contentLength,
    };
  }

  async downloadFile(
    destinationKey: string,
    localDestinationPath: string,
  ): Promise<string> {
    ensureDirExists(path.dirname(localDestinationPath));
    const source = await this.getReadStream(destinationKey);
    await pipeline(source, fs.createWriteStream(localDestinationPath));
    return localDestinationPath;
  }

  async getReadStream(destinationKey: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.normalizeKey(destinationKey),
      }),
    );
    const body = response.Body;

    if (body instanceof Readable) {
      return body;
    }

    const webStreamBody = body as
      | { transformToWebStream?: () => NodeReadableStream }
      | undefined;
    if (typeof webStreamBody?.transformToWebStream === 'function') {
      return Readable.fromWeb(webStreamBody.transformToWebStream());
    }

    throw new Error(`S3 object body is not readable: ${destinationKey}`);
  }

  async deleteFile(destinationKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: this.normalizeKey(destinationKey),
      }),
    );
  }

  async exists(destinationKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: this.normalizeKey(destinationKey),
        }),
      );
      return true;
    } catch (error: unknown) {
      const storageError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      const statusCode = storageError.$metadata?.httpStatusCode;
      if (
        statusCode === 404 ||
        storageError.name === 'NotFound' ||
        storageError.name === 'NoSuchKey'
      ) {
        return false;
      }
      throw error;
    }
  }

  private normalizeKey(destinationKey: string): string {
    return destinationKey.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  private buildObjectUrl(key: string): string {
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    if (this.config.endpoint) {
      return `${this.config.endpoint.replace(/\/+$/, '')}/${encodeURIComponent(
        this.config.bucket,
      )}/${encodedKey}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${encodedKey}`;
  }
}
