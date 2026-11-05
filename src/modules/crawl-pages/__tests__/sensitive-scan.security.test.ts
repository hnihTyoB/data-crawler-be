import { SensitiveScanService } from "../sensitive-scan.service";

describe("SensitiveScanService Security Patches (SEC-26)", () => {
  let scanner: SensitiveScanService;

  beforeEach(() => {
    scanner = new SensitiveScanService();
  });

  it("detects sensitive patterns in normal text", () => {
    expect(scanner.hasSensitiveData("Contact us at test@example.com for info")).toBe(true);
    expect(scanner.hasSensitiveData("Hotline: 0912345678")).toBe(true);
    expect(scanner.hasSensitiveData("ID number: 123456789012")).toBe(true);
    expect(scanner.hasSensitiveData("Public text without any private credentials")).toBe(false);
  });

  it("handles null, undefined, or empty strings gracefully without throwing", () => {
    expect(scanner.hasSensitiveData("")).toBe(false);
    expect(scanner.hasSensitiveData(null as any)).toBe(false);
    expect(scanner.hasSensitiveData(undefined as any)).toBe(false);
  });

  it("caps scan length to 100KB to prevent event loop blocking on huge crawled payloads (SEC-26)", () => {
    // Generate a 1MB payload of repetitive text designed to maximize regex backtracking
    const largeText = "4111-1111-1111-111a ".repeat(50_000); // ~1MB
    expect(largeText.length).toBeGreaterThan(500_000);

    const startTime = Date.now();
    const result = scanner.hasSensitiveData(largeText);
    const durationMs = Date.now() - startTime;

    // Must evaluate in a few milliseconds due to input capping at 100KB
    expect(durationMs).toBeLessThan(100);
    expect(typeof result).toBe("boolean");
  });
});
