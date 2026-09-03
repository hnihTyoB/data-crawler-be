import { Request, Response, NextFunction } from "express";
import { ZodTypeAny } from "zod";
import { AppError } from "../common/errors/app-error";
import { ERROR_CODE } from "../common/errors/error-code";

export function validate(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      const messages = details
        .map((d) => `${d.field}: ${d.message}`)
        .join(", ");
      next(new AppError(messages, 422, ERROR_CODE.VALIDATION_ERROR, details));
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      const messages = details
        .map((d) => `${d.field}: ${d.message}`)
        .join(", ");
      next(new AppError(messages, 422, ERROR_CODE.VALIDATION_ERROR, details));
      return;
    }
    req.query = result.data as unknown as Request["query"];
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const details = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      const messages = details
        .map((d) => `${d.field}: ${d.message}`)
        .join(", ");
      next(new AppError(messages, 422, ERROR_CODE.VALIDATION_ERROR, details));
      return;
    }
    req.params = result.data as unknown as Request["params"];
    next();
  };
}
