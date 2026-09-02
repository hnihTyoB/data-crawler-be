export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'; // Vietnam UTC+7

export interface NextRunParams {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  hour?: number;
  minute?: number;
  dayOfWeek?: number | null; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfMonth?: number | null; // 1 - 31
  cronExpression?: string | null;
  timezone?: string;
  fromDate?: Date;
}

/**
 * Checks if a standard 5-part cron expression is structurally valid.
 * Format: "minute hour day-of-month month day-of-week"
 */
export function isValidCronExpression(cron: string | null | undefined): boolean {
  if (!cron || typeof cron !== 'string') return false;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, dom, mon, dow] = parts;
  return (
    isValidCronField(min, 0, 59) &&
    isValidCronField(hour, 0, 23) &&
    isValidCronField(dom, 1, 31) &&
    isValidCronField(mon, 1, 12) &&
    isValidCronField(dow, 0, 7) // 0 or 7 = Sunday
  );
}

function isValidCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  // Step: */5 or 1-10/2
  if (field.includes('/')) {
    const [range, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;
    if (range === '*') return true;
    return isValidCronField(range, min, max);
  }

  // Comma separated: 1,2,5
  if (field.includes(',')) {
    return field.split(',').every((sub) => isValidCronField(sub, min, max));
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
  }

  // Single number
  const num = parseInt(field, 10);
  return !isNaN(num) && num >= min && num <= max;
}

function matchesCronField(field: string, val: number, min: number, max: number): boolean {
  if (field === '*') return true;

  if (field.includes(',')) {
    return field.split(',').some((sub) => matchesCronField(sub, val, min, max));
  }

  if (field.includes('/')) {
    const [range, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    const start = range === '*' ? min : parseInt(range.split('-')[0], 10);
    const end = range === '*' || !range.includes('-') ? max : parseInt(range.split('-')[1], 10);
    if (val < start || val > end) return false;
    return (val - start) % step === 0;
  }

  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    return val >= start && val <= end;
  }

  const num = parseInt(field, 10);
  return num === val;
}

function getDaysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

/**
 * Returns the offset in minutes for a given timezone (e.g. +420 for UTC+7 / Asia/Ho_Chi_Minh).
 */
export function getTimezoneOffsetMinutes(timezone = DEFAULT_TIMEZONE, date = new Date()): number {
  const tz = (timezone || DEFAULT_TIMEZONE).trim();
  if (tz === 'UTC' || tz === 'Z' || tz === '+00:00' || tz === '+00') {
    return 0;
  }
  if (
    tz === 'Asia/Ho_Chi_Minh' ||
    tz === 'Asia/Saigon' ||
    tz === 'Asia/Bangkok' ||
    tz === 'UTC+7' ||
    tz === '+07:00' ||
    tz === '+07' ||
    tz === 'GMT+7'
  ) {
    return 420; // 7 hours * 60 min
  }
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
    const year = getPart('year');
    const month = getPart('month') - 1;
    const day = getPart('day');
    const hour = getPart('hour') % 24;
    const minute = getPart('minute');
    const second = getPart('second');
    const targetUtcTimestamp = Date.UTC(year, month, day, hour, minute, second);
    return Math.round((targetUtcTimestamp - date.getTime()) / 60000);
  } catch {
    return 420; // Fallback to Vietnam UTC+7
  }
}

/**
 * Gets date parts (year, month (0-11), day (1-31), dayOfWeek (0-6), hour (0-23), minute (0-59))
 * in the specified timezone for a given UTC Date.
 */
export function getZonedDateParts(date: Date, timezone = DEFAULT_TIMEZONE) {
  const offsetMin = getTimezoneOffsetMinutes(timezone, date);
  const localTimeMs = date.getTime() + offsetMin * 60000;
  const localDate = new Date(localTimeMs);
  return {
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth(),
    day: localDate.getUTCDate(),
    dayOfWeek: localDate.getUTCDay(),
    hour: localDate.getUTCHours(),
    minute: localDate.getUTCMinutes(),
    offsetMin,
  };
}

/**
 * Converts local date parts in a timezone back into an exact UTC Date.
 */
export function createUtcDateFromZonedParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone = DEFAULT_TIMEZONE,
): Date {
  const rawUtcMs = Date.UTC(year, month, day, hour, minute, 0, 0);
  const approxDate = new Date(rawUtcMs);
  const offsetMin = getTimezoneOffsetMinutes(timezone, approxDate);
  return new Date(rawUtcMs - offsetMin * 60000);
}

/**
 * Calculates the next execution Date based on schedule parameters in Vietnam (UTC+7) or chosen timezone.
 */
export function calculateNextRun(params: NextRunParams): Date {
  const timezone = params.timezone || DEFAULT_TIMEZONE;
  const from = params.fromDate ? new Date(params.fromDate) : new Date();
  const hour = Math.max(0, Math.min(23, params.hour ?? 0));
  const minute = Math.max(0, Math.min(59, params.minute ?? 0));

  const currentZoned = getZonedDateParts(from, timezone);

  if (params.frequency === 'DAILY') {
    let targetYear = currentZoned.year;
    let targetMonth = currentZoned.month;
    let targetDay = currentZoned.day;

    const currentTotalMin = currentZoned.hour * 60 + currentZoned.minute;
    const targetTotalMin = hour * 60 + minute;

    if (targetTotalMin <= currentTotalMin) {
      // Time has passed today in this timezone -> move to tomorrow
      targetDay += 1;
      const maxDays = getDaysInMonth(targetYear, targetMonth);
      if (targetDay > maxDays) {
        targetDay = 1;
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }
    }

    return createUtcDateFromZonedParts(targetYear, targetMonth, targetDay, hour, minute, timezone);
  }

  if (params.frequency === 'WEEKLY') {
    const targetDow = params.dayOfWeek !== undefined && params.dayOfWeek !== null
      ? Math.max(0, Math.min(6, params.dayOfWeek))
      : 0; // Default to Sunday (0)

    let daysToAdd = (targetDow - currentZoned.dayOfWeek + 7) % 7;
    const currentTotalMin = currentZoned.hour * 60 + currentZoned.minute;
    const targetTotalMin = hour * 60 + minute;

    if (daysToAdd === 0 && targetTotalMin <= currentTotalMin) {
      daysToAdd = 7;
    }

    let targetYear = currentZoned.year;
    let targetMonth = currentZoned.month;
    let targetDay = currentZoned.day + daysToAdd;

    const maxDays = getDaysInMonth(targetYear, targetMonth);
    if (targetDay > maxDays) {
      targetDay -= maxDays;
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    return createUtcDateFromZonedParts(targetYear, targetMonth, targetDay, hour, minute, timezone);
  }

  if (params.frequency === 'MONTHLY') {
    const targetDom = params.dayOfMonth !== undefined && params.dayOfMonth !== null
      ? Math.max(1, Math.min(31, params.dayOfMonth))
      : 1;

    let targetYear = currentZoned.year;
    let targetMonth = currentZoned.month;

    const maxDaysCurrent = getDaysInMonth(targetYear, targetMonth);
    const clampedCurrent = Math.min(targetDom, maxDaysCurrent);

    const currentTotalMin = currentZoned.hour * 60 + currentZoned.minute;
    const targetTotalMin = hour * 60 + minute;

    const isPastThisMonth =
      currentZoned.day > clampedCurrent ||
      (currentZoned.day === clampedCurrent && targetTotalMin <= currentTotalMin);

    if (isPastThisMonth) {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
    }

    const maxDaysNext = getDaysInMonth(targetYear, targetMonth);
    const finalDay = Math.min(targetDom, maxDaysNext);

    return createUtcDateFromZonedParts(targetYear, targetMonth, finalDay, hour, minute, timezone);
  }

  if (params.frequency === 'CUSTOM') {
    const cron = params.cronExpression?.trim();
    if (!cron || !isValidCronExpression(cron)) {
      throw new Error(`Invalid cron expression: "${params.cronExpression}"`);
    }

    const [minStr, hourStr, domStr, monStr, dowStr] = cron.split(/\s+/);
    // Start searching from 1 minute after fromDate
    const offsetMin = getTimezoneOffsetMinutes(timezone, from);
    const localCursor = new Date(from.getTime() + offsetMin * 60000);
    localCursor.setUTCSeconds(0, 0);
    localCursor.setUTCMinutes(localCursor.getUTCMinutes() + 1);

    const maxMinutes = 527040; // 366 days max
    for (let i = 0; i < maxMinutes; i++) {
      const curMin = localCursor.getUTCMinutes();
      const curHour = localCursor.getUTCHours();
      const curDom = localCursor.getUTCDate();
      const curMon = localCursor.getUTCMonth() + 1; // 1-12
      const curDow = localCursor.getUTCDay(); // 0-6

      const matchMin = matchesCronField(minStr, curMin, 0, 59);
      const matchHour = matchesCronField(hourStr, curHour, 0, 23);
      const matchDom = matchesCronField(domStr, curDom, 1, 31);
      const matchMon = matchesCronField(monStr, curMon, 1, 12);
      const matchDow = matchesCronField(dowStr, curDow, 0, 7) || (curDow === 0 && matchesCronField(dowStr, 7, 0, 7));

      if (matchMin && matchHour && matchDom && matchMon && matchDow) {
        return createUtcDateFromZonedParts(
          localCursor.getUTCFullYear(),
          localCursor.getUTCMonth(),
          localCursor.getUTCDate(),
          curHour,
          curMin,
          timezone,
        );
      }

      localCursor.setUTCMinutes(localCursor.getUTCMinutes() + 1);
    }

    throw new Error(`Could not find next run within 1 year for cron expression: "${cron}"`);
  }

  throw new Error(`Unsupported schedule frequency: ${params.frequency}`);
}
