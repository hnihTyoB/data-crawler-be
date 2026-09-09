import { z } from "zod";
import { CRON_JOB_NAMES } from "../../common/constants/cron.constant";

export const cronJobParamsSchema = z.object({
  jobName: z.nativeEnum(CRON_JOB_NAMES, {
    errorMap: () => ({ message: "Tên tác vụ không tồn tại trong hệ thống" }),
  }),
});

export const triggerCronJobBodySchema = z.object({
  params: z.record(z.unknown()).optional(),
});

export const toggleCronJobBodySchema = z.object({
  enabled: z.boolean({
    required_error: "Trường 'enabled' là bắt buộc (true hoặc false)",
  }),
});

export const listCronJobsQuerySchema = z.object({
  search: z.string().trim().optional(),
});
