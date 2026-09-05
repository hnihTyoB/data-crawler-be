import { Request, Response, NextFunction } from "express";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export function notFoundMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  next(
    new AppError(
      `Route ${req.method} ${req.originalUrl} not found`,
      404,
      ERROR_CODE.NOT_FOUND,
    ),
  );
}

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
      ...(error.details ? { errors: error.details } : {}),
    });
    return;
  }

  // Handle Prisma Known Request Errors
  const prismaError = error as { code?: string; meta?: { target?: string[] } };
  if (
    prismaError.code &&
    typeof prismaError.code === "string" &&
    prismaError.code.startsWith("P")
  ) {
    switch (prismaError.code) {
      case "P2002": {
        const target = Array.isArray(prismaError.meta?.target)
          ? prismaError.meta.target.join(", ")
          : "field";
        res.status(409).json({
          success: false,
          message: `A record with this ${target} already exists.`,
          code: ERROR_CODE.DUPLICATE_ENTRY,
        });
        return;
      }
      case "P2023": {
        res.status(400).json({
          success: false,
          message: "Invalid input format or malformed identifier.",
          code: ERROR_CODE.VALIDATION_ERROR,
        });
        return;
      }
      case "P2025": {
        res.status(404).json({
          success: false,
          message: "Requested record not found.",
          code: ERROR_CODE.NOT_FOUND,
        });
        return;
      }
      case "P2003": {
        res.status(400).json({
          success: false,
          message:
            "Referenced record does not exist or relation constraint failed.",
          code: ERROR_CODE.VALIDATION_ERROR,
        });
        return;
      }
      default:
        break;
    }
  }

  console.error("[Unhandled Error]", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: ERROR_CODE.INTERNAL_SERVER_ERROR,
  });
}
