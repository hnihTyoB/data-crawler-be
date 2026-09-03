import path from "path";
import { envConfig } from "./env.config";

export const storageConfig = {
  driver: envConfig.storage.driver,
  exportDir: path.resolve(process.cwd(), envConfig.storage.exportDir),
  s3: envConfig.storage.s3,
};
