import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../modules/api-keys/api-key.service';
import { prisma } from '../database/prisma.client';
import { authMiddleware } from './auth.middleware';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';

const apiKeyService = new ApiKeyService();

export async function apiKeyOrAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    try {
      const validKeyRecord = await apiKeyService.validate(apiKey);
      
      const user = await prisma.user.findFirst({
        where: { id: validKeyRecord.userId, deletedAt: null },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user) {
        next(new AppError('User associated with API key not found', 401, ERROR_CODE.UNAUTHORIZED));
        return;
      }

      if (!user.isActive) {
        next(new AppError('Account is inactive', 403, ERROR_CODE.USER_INACTIVE));
        return;
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  } else {
    authMiddleware(req, res, next);
  }
}
