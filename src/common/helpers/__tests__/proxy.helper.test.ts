import { parseTrustProxy } from "../proxy.helper";

describe("parseTrustProxy (SEC-09)", () => {
  it("converts 'true' to 1 (single upstream proxy hop) to prevent leftmost IP spoofing", () => {
    expect(parseTrustProxy("true")).toBe(1);
    expect(parseTrustProxy("TRUE")).toBe(1);
    expect(parseTrustProxy("  true  ")).toBe(1);
  });

  it("converts 'false' to boolean false", () => {
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("FALSE")).toBe(false);
    expect(parseTrustProxy("  false  ")).toBe(false);
  });

  it("parses numeric hop counts correctly", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("  3  ")).toBe(3);
  });

  it("preserves explicit subnet CIDRs and named subnet lists", () => {
    expect(parseTrustProxy("loopback, linklocal, uniquelocal")).toBe(
      "loopback, linklocal, uniquelocal",
    );
    expect(parseTrustProxy("10.0.0.0/8")).toBe("10.0.0.0/8");
    expect(parseTrustProxy("127.0.0.1")).toBe("127.0.0.1");
  });
});
