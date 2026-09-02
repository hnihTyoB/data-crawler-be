import 'dotenv/config';
import { envConfig } from '../config/env.config';
import { CrawlScheduleService } from '../modules/crawl-schedules/crawl-schedule.service';

import { getErrorMessage } from '../common/helpers/error-mapping.helper';

if (!envConfig.redis.enabled) {
  console.log('[Schedule Worker] REDIS_ENABLED is not set to true. Schedule Worker will not start.');
  process.exit(0);
}

const scheduleService = new CrawlScheduleService();
let intervalTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

export async function checkAndProcessDueSchedules() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const triggered = await scheduleService.processDueSchedules();
    if (triggered > 0) {
      console.log(`[Schedule Worker] Triggered ${triggered} due scheduled crawl jobs`);
    }
  } catch (err: unknown) {
    console.error(`[Schedule Worker] Error processing due schedules: ${getErrorMessage(err)}`);
  } finally {
    isProcessing = false;
  }
}

export function startScheduleWorker(intervalMs = 60000): void {
  console.log(`[Schedule Worker] Started checking due schedules every ${intervalMs / 1000}s`);
  // Run an immediate check on startup
  void checkAndProcessDueSchedules();
  intervalTimer = setInterval(() => {
    void checkAndProcessDueSchedules();
  }, intervalMs);
}

export function stopScheduleWorker(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
    console.log('[Schedule Worker] Stopped');
  }
}

// Standalone execution
if (require.main === module) {
  startScheduleWorker();

  const shutdown = (signal: string) => {
    console.log(`[Schedule Worker] Received ${signal}, shutting down...`);
    stopScheduleWorker();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
