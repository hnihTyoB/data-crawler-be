import { PrismaClient } from '@prisma/client';
import { databaseConfig } from '../config/database.config';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseConfig.url,
    },
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error', 'warn'],
});
