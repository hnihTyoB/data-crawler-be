import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  IStorageService,
  UploadResult,
  UploadStreamOptions,
} from './storage.interface';
import { storageConfig } from '../../config/storage.config';
import { ensureDirExists, getFileSizeBytes } from '../helpers/file.helper';

export class LocalStorageService implements IStorageService {
  private getAbsolutePath(key: string): string {
    if (path.isAbsolute(key)) return key;
    return path.join(storageConfig.exportDir, key);
  }

  async uploadFile(
    localFilePath: string,
    destinationKey: string,
  ): Promise<UploadResult> {
    const targetPath = this.getAbsolutePath(destinationKey);
    ensureDirExists(path.dirname(targetPath));

    if (path.resolve(localFilePath) !== path.resolve(targetPath)) {
      fs.copyFileSync(localFilePath, targetPath);
    }

    return {
      fileName: path.basename(destinationKey),
      filePath: targetPath,
      sizeBytes: getFileSizeBytes(targetPath),
    };
  }

  async uploadStream(
    destinationKey: string,
    source: Readable,
    _options: UploadStreamOptions = {},
  ): Promise<UploadResult> {
    const targetPath = this.getAbsolutePath(destinationKey);
    ensureDirExists(path.dirname(targetPath));

    await pipeline(source, fs.createWriteStream(targetPath));

    return {
      fileName: path.basename(destinationKey),
      filePath: targetPath,
      sizeBytes: getFileSizeBytes(targetPath),
    };
  }

  async downloadFile(
    destinationKey: string,
    localDestinationPath: string,
  ): Promise<string> {
    const srcPath = this.getAbsolutePath(destinationKey);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Local file not found: ${srcPath}`);
    }

    ensureDirExists(path.dirname(localDestinationPath));
    if (path.resolve(srcPath) !== path.resolve(localDestinationPath)) {
      fs.copyFileSync(srcPath, localDestinationPath);
    }
    return localDestinationPath;
  }

  async getReadStream(destinationKey: string): Promise<Readable> {
    const filePath = this.getAbsolutePath(destinationKey);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${filePath}`);
    }
    return fs.createReadStream(filePath);
  }

  async deleteFile(destinationKey: string): Promise<void> {
    const filePath = this.getAbsolutePath(destinationKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async exists(destinationKey: string): Promise<boolean> {
    const filePath = this.getAbsolutePath(destinationKey);
    return fs.existsSync(filePath);
  }
}
