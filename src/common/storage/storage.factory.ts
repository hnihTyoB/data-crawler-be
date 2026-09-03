import { IStorageService } from "./storage.interface";
import { LocalStorageService } from "./local-storage.service";
import { S3StorageService } from "./s3-storage.service";
import { storageConfig } from "../../config/storage.config";

export class StorageFactory {
  private static instance: IStorageService;
  private static activeDriver: string;

  public static getStorageService(): IStorageService {
    if (
      !StorageFactory.instance ||
      StorageFactory.activeDriver !== storageConfig.driver
    ) {
      if (storageConfig.driver === "s3") {
        StorageFactory.instance = new S3StorageService();
      } else if (storageConfig.driver === "local") {
        StorageFactory.instance = new LocalStorageService();
      } else {
        throw new Error(`Unsupported storage driver: ${storageConfig.driver}`);
      }
      StorageFactory.activeDriver = storageConfig.driver;
    }
    return StorageFactory.instance;
  }
}
