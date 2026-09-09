import {
  createCrawlScheduleSchema,
  updateCrawlScheduleSchema,
  isValidTimezone,
} from "../crawl-schedule.validation";

describe("CrawlScheduleValidation - Timezone tests (BUG-010)", () => {
  it("isValidTimezone validates correct IANA timezones", () => {
    expect(isValidTimezone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
  });

  it("isValidTimezone rejects invalid timezones", () => {
    expect(isValidTimezone("UTC+999")).toBe(false);
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
    expect(isValidTimezone("Vietnam/Saigon_Fake")).toBe(false);
  });

  it("rejects invalid timezone in createCrawlScheduleSchema", () => {
    const result = createCrawlScheduleSchema.safeParse({
      name: "Test Schedule",
      startUrl: "https://example.com",
      timezone: "Invalid/Fake_Zone",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const timezoneIssue = result.error.issues.find((i) => i.path.includes("timezone"));
      expect(timezoneIssue).toBeDefined();
      expect(timezoneIssue?.message).toContain("Invalid IANA timezone identifier");
    }
  });

  it("accepts valid IANA timezone in createCrawlScheduleSchema", () => {
    const result = createCrawlScheduleSchema.safeParse({
      name: "Test Schedule",
      startUrl: "https://example.com",
      timezone: "Asia/Ho_Chi_Minh",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid timezone in updateCrawlScheduleSchema", () => {
    const result = updateCrawlScheduleSchema.safeParse({
      timezone: "Fake/Timezone",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const timezoneIssue = result.error.issues.find((i) => i.path.includes("timezone"));
      expect(timezoneIssue).toBeDefined();
    }
  });
});
