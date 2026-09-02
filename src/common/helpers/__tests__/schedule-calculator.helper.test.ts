import {
  calculateNextRun,
  isValidCronExpression,
  getTimezoneOffsetMinutes,
  getZonedDateParts,
  DEFAULT_TIMEZONE,
} from '../schedule-calculator.helper';

describe('schedule-calculator.helper', () => {
  describe('isValidCronExpression', () => {
    it('returns true for valid standard cron expressions', () => {
      expect(isValidCronExpression('* * * * *')).toBe(true);
      expect(isValidCronExpression('0 0 * * *')).toBe(true);
      expect(isValidCronExpression('*/15 0-23 * * *')).toBe(true);
      expect(isValidCronExpression('0 9 1,15 * 1-5')).toBe(true);
      expect(isValidCronExpression('30 4 1 * 0')).toBe(true);
    });

    it('returns false for invalid cron expressions', () => {
      expect(isValidCronExpression('')).toBe(false);
      expect(isValidCronExpression('invalid')).toBe(false);
      expect(isValidCronExpression('0 0 * *')).toBe(false); // 4 parts
      expect(isValidCronExpression('0 0 * * * *')).toBe(false); // 6 parts
      expect(isValidCronExpression('60 * * * *')).toBe(false); // invalid minute
      expect(isValidCronExpression('* 25 * * *')).toBe(false); // invalid hour
      expect(isValidCronExpression('* * 32 * *')).toBe(false); // invalid dom
      expect(isValidCronExpression('* * * 13 *')).toBe(false); // invalid month
      expect(isValidCronExpression('* * * * 8')).toBe(false); // invalid dow
    });
  });

  describe('Vietnam timezone (UTC+7) calculations', () => {
    it('returns +420 minutes offset for Asia/Ho_Chi_Minh', () => {
      expect(getTimezoneOffsetMinutes('Asia/Ho_Chi_Minh')).toBe(420);
      expect(DEFAULT_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
    });

    it('extracts Vietnam zoned date parts correctly', () => {
      // 12:15 UTC is 19:15 Vietnam time (+7 hours)
      const utcDate = new Date('2026-09-02T12:15:00.000Z');
      const parts = getZonedDateParts(utcDate, 'Asia/Ho_Chi_Minh');

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(8); // Sept (0-indexed)
      expect(parts.day).toBe(2);
      expect(parts.hour).toBe(19);
      expect(parts.minute).toBe(15);
      expect(parts.dayOfWeek).toBe(3); // Wednesday
    });

    it('calculates DAILY crawl at 20:00 VN time (same day in VN)', () => {
      // Current time: 19:15 VN time (12:15 UTC)
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'DAILY',
        hour: 20,
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // 20:00 VN time on Sept 2 is 13:00 UTC on Sept 2
      expect(next.toISOString()).toBe('2026-09-02T13:00:00.000Z');
    });

    it('calculates DAILY crawl at 02:00 VN time (next day in VN)', () => {
      // Current time: 19:15 VN time on Sept 2 (12:15 UTC)
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'DAILY',
        hour: 2,
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // 02:00 VN time on Sept 3 is 19:00 UTC on Sept 2
      expect(next.toISOString()).toBe('2026-09-02T19:00:00.000Z');
    });

    it('calculates WEEKLY crawl on Friday (day 5) at 08:00 VN time', () => {
      // Current time: Wednesday Sept 2, 19:15 VN time
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'WEEKLY',
        dayOfWeek: 5,
        hour: 8,
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // Friday Sept 4, 08:00 VN time is Sept 4, 01:00 UTC
      expect(next.toISOString()).toBe('2026-09-04T01:00:00.000Z');
    });

    it('calculates MONTHLY crawl on 15th at 09:30 VN time', () => {
      // Current time: Sept 2, 19:15 VN time
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'MONTHLY',
        dayOfMonth: 15,
        hour: 9,
        minute: 30,
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // Sept 15, 09:30 VN time is Sept 15, 02:30 UTC
      expect(next.toISOString()).toBe('2026-09-15T02:30:00.000Z');
    });

    it('calculates MONTHLY crawl for next month if day has passed in VN time', () => {
      // Current time: Sept 2, 19:15 VN time
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        hour: 9,
        minute: 0,
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // Oct 1, 09:00 VN time is Oct 1, 02:00 UTC
      expect(next.toISOString()).toBe('2026-10-01T02:00:00.000Z');
    });

    it('calculates CUSTOM cron in Vietnam time', () => {
      // Current time: Sept 2, 19:15 VN time (12:15 UTC)
      // Cron: "0 22 * * *" (22:00 VN time every day)
      const from = new Date('2026-09-02T12:15:00.000Z');
      const next = calculateNextRun({
        frequency: 'CUSTOM',
        cronExpression: '0 22 * * *',
        timezone: 'Asia/Ho_Chi_Minh',
        fromDate: from,
      });

      // 22:00 VN time on Sept 2 is 15:00 UTC on Sept 2
      expect(next.toISOString()).toBe('2026-09-02T15:00:00.000Z');
    });

    it('throws error on invalid cron expression', () => {
      expect(() => {
        calculateNextRun({
          frequency: 'CUSTOM',
          cronExpression: 'invalid cron',
          timezone: 'Asia/Ho_Chi_Minh',
        });
      }).toThrow('Invalid cron expression');
    });
  });
});
