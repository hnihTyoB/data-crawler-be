import 'dotenv/config';
import { envConfig } from './config/env.config';
import Redis from 'ioredis';

async function bootstrap() {
  if (!envConfig.redis.enabled) {
    console.error('[Server] REDIS_ENABLED is not set to true. Redis is required.');
    console.error('[Server] Start Docker and set REDIS_ENABLED=true in .env, then try again.');
    process.exit(1);
  }

  const redis = new Redis({
    host: envConfig.redis.host,
    port: envConfig.redis.port,
    maxRetriesPerRequest: 0,
    lazyConnect: true,
  });

  redis.on('error', () => {});

  try {
    await redis.connect();
    await redis.ping();
    await redis.quit();
    console.log('[Server] Redis connection confirmed.');
  } catch {
    console.error('[Server] Cannot connect to Redis. Is Docker running?');
    console.error('[Server] Run: docker compose up -d');
    process.exit(1);
  }

  // Only import app AFTER Redis is confirmed — this delays crawlQueue instantiation
  const { default: app } = await import('./app');
  const { initLocalStorage } = await import('./common/helpers/file.helper');

  initLocalStorage();

  await import('./queues/webhook.worker');
  console.log('[Server] Webhook worker initialized in background.');

  const { startScheduleWorker } = await import('./queues/schedule.worker');
  startScheduleWorker();
  console.log('[Server] Schedule worker initialized in background.');

  app.listen(envConfig.port, () => {
    console.log(`Server running on port ${envConfig.port} in ${envConfig.nodeEnv} mode`);
  });
}

bootstrap();