import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export const ALLOWED_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AVATAR_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_AVATAR_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_AVATAR_MIME_TYPES)[number],
      )
    ) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Chỉ chấp nhận tệp hình ảnh (JPEG, PNG, WebP, GIF).",
          422,
          ERROR_CODE.VALIDATION_ERROR,
        ),
      );
    }
  },
});

export function uploadAvatarMiddleware(fieldName = "avatar") {
  const single = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    single(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return next(
              new AppError(
                "Kích thước tệp vượt quá giới hạn cho phép (tối đa 5MB).",
                422,
                ERROR_CODE.VALIDATION_ERROR,
              ),
            );
          }
          return next(
            new AppError(
              `Lỗi tải lên tệp: ${err.message}`,
              422,
              ERROR_CODE.VALIDATION_ERROR,
            ),
          );
        }
        return next(err);
      }
      next();
    });
  };
}
