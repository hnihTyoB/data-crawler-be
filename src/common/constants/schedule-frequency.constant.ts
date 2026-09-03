export const SCHEDULE_FREQUENCY = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  CUSTOM: "CUSTOM",
} as const;

export const SCHEDULE_FREQUENCIES = SCHEDULE_FREQUENCY;

export type ScheduleFrequency = keyof typeof SCHEDULE_FREQUENCY;
