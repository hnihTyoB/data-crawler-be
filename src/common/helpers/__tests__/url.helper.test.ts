jest.mock("dns");

import {
  validateUrl,
  validateUrlAsync,
  extractDomain,
  secureLookup,
  getSecureAxios,
} from "../url.helper";
import { AppError } from "../../errors/app-error";
import * as dns from "dns";
// Mock helper — all:true returns LookupAddress[], not a single string

function mockLookup(addresses: dns.LookupAddress[], error?: Error) {
  (dns.lookup as unknown as jest.Mock).mockImplementation(
    (_host: string, _opts: any, cb: Function) => {
      if (error) cb(error, []);
      else cb(null, addresses);
    },
  );
}

// validateUrl — sync

describe("validateUrl", () => {
  // Valid
  it("accepts a valid http URL", () => {
    expect(validateUrl("http://example.com").hostname).toBe("example.com");
  });

  it("accepts a valid https URL", () => {
    expect(validateUrl("https://example.com/path?q=1").hostname).toBe(
      "example.com",
    );
  });

  // Format
  it("throws on malformed URL", () => {
    expect(() => validateUrl("not-a-url")).toThrow(AppError);
  });

  // Protocols
  it("throws on file:// protocol", () => {
    expect(() => validateUrl("file:///etc/passwd")).toThrow(AppError);
  });

  it("throws on ftp:// protocol", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow(AppError);
  });

  // IPv4 — loopback
  it("throws on localhost", () => {
    expect(() => validateUrl("http://localhost/admin")).toThrow(AppError);
  });

  it("throws on 127.0.0.1", () => {
    expect(() => validateUrl("http://127.0.0.1")).toThrow(AppError);
  });

  it("throws on 127.0.0.2 (non-first 127.x address)", () => {
    expect(() => validateUrl("http://127.0.0.2")).toThrow(AppError);
  });

  it("throws on 127.255.255.255 (last 127.x address)", () => {
    expect(() => validateUrl("http://127.255.255.255")).toThrow(AppError);
  });

  // IPv4 — private ranges
  it("throws on 10.x.x.x", () => {
    expect(() => validateUrl("http://10.0.0.1")).toThrow(AppError);
  });

  it("throws on 172.16.x.x", () => {
    expect(() => validateUrl("http://172.16.0.1")).toThrow(AppError);
  });

  it("throws on 172.31.x.x (last of private range)", () => {
    expect(() => validateUrl("http://172.31.255.255")).toThrow(AppError);
  });

  it("accepts 172.15.x.x (just outside private range)", () => {
    expect(() => validateUrl("http://172.15.0.1")).not.toThrow();
  });

  it("accepts 172.32.x.x (just outside private range)", () => {
    expect(() => validateUrl("http://172.32.0.1")).not.toThrow();
  });

  it("throws on 192.168.x.x", () => {
    expect(() => validateUrl("http://192.168.1.1")).toThrow(AppError);
  });

  it("throws on 169.254.169.254 (AWS metadata)", () => {
    expect(() => validateUrl("http://169.254.169.254")).toThrow(AppError);
  });

  it("throws on 0.0.0.0", () => {
    expect(() => validateUrl("http://0.0.0.0")).toThrow(AppError);
  });

  // IPv4 — CGNAT (RFC 6598) 100.64.0.0/10
  it("throws on 100.64.0.0 (CGNAT range start)", () => {
    expect(() => validateUrl("http://100.64.0.0")).toThrow(AppError);
  });

  it("throws on 100.127.255.255 (CGNAT range end)", () => {
    expect(() => validateUrl("http://100.127.255.255")).toThrow(AppError);
  });

  it("accepts 100.63.255.255 (just below CGNAT range)", () => {
    expect(() => validateUrl("http://100.63.255.255")).not.toThrow();
  });

  it("accepts 100.128.0.0 (just above CGNAT range)", () => {
    expect(() => validateUrl("http://100.128.0.0")).not.toThrow();
  });

  // IPv4 — RFC 5737 TEST-NET ranges
  it("throws on 192.0.2.1 (TEST-NET-1)", () => {
    expect(() => validateUrl("http://192.0.2.1")).toThrow(AppError);
  });

  it("throws on 198.51.100.1 (TEST-NET-2)", () => {
    expect(() => validateUrl("http://198.51.100.1")).toThrow(AppError);
  });

  it("throws on 203.0.113.1 (TEST-NET-3)", () => {
    expect(() => validateUrl("http://203.0.113.1")).toThrow(AppError);
  });

  // IPv4 — RFC 2544 benchmarking
  it("throws on 198.18.0.1 (benchmarking range)", () => {
    expect(() => validateUrl("http://198.18.0.1")).toThrow(AppError);
  });

  it("throws on 198.19.255.255 (benchmarking range end)", () => {
    expect(() => validateUrl("http://198.19.255.255")).toThrow(AppError);
  });

  // IPv6
  it("throws on ::1 (IPv6 loopback)", () => {
    expect(() => validateUrl("http://[::1]")).toThrow(AppError);
  });

  it("throws on :: (IPv6 unspecified)", () => {
    expect(() => validateUrl("http://[::]")).toThrow(AppError);
  });

  it("throws on fc00:: (IPv6 ULA fc-prefix)", () => {
    expect(() => validateUrl("http://[fc00::1]")).toThrow(AppError);
  });

  it("throws on fd00:: (IPv6 ULA fd-prefix)", () => {
    expect(() => validateUrl("http://[fd00::1]")).toThrow(AppError);
  });

  it("throws on fe80:: (IPv6 link-local)", () => {
    expect(() => validateUrl("http://[fe80::1]")).toThrow(AppError);
  });

  it("throws on 2001:db8:: (documentation range)", () => {
    expect(() => validateUrl("http://[2001:db8::1]")).toThrow(AppError);
  });

  it("throws on ff02:: (multicast)", () => {
    expect(() => validateUrl("http://[ff02::1]")).toThrow(AppError);
  });

  // IPv4-mapped IPv6
  it("throws on ::ffff:127.0.0.1 (mapped loopback)", () => {
    expect(() => validateUrl("http://[::ffff:127.0.0.1]")).toThrow(AppError);
  });

  it("throws on ::ffff:10.0.0.1 (mapped private)", () => {
    expect(() => validateUrl("http://[::ffff:10.0.0.1]")).toThrow(AppError);
  });

  it("throws on ::ffff:192.168.1.1 (mapped private)", () => {
    expect(() => validateUrl("http://[::ffff:192.168.1.1]")).toThrow(AppError);
  });

  it("throws on ::ffff:169.254.169.254 (mapped AWS metadata)", () => {
    expect(() => validateUrl("http://[::ffff:169.254.169.254]")).toThrow(
      AppError,
    );
  });

  it("throws on ::ffff:100.64.0.1 (mapped CGNAT)", () => {
    expect(() => validateUrl("http://[::ffff:100.64.0.1]")).toThrow(AppError);
  });
});

// validateUrlAsync — DNS rebinding protection

describe("validateUrlAsync", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it("resolves valid public hostname without throwing", async () => {
    mockLookup([{ address: "93.184.216.34", family: 4 }]);
    await expect(
      validateUrlAsync("https://example.com"),
    ).resolves.toBeDefined();
  });

  it("throws when hostname resolves to private IPv4 (DNS rebinding)", async () => {
    mockLookup([{ address: "169.254.169.254", family: 4 }]);
    await expect(validateUrlAsync("https://evil.attacker.com")).rejects.toThrow(
      AppError,
    );
  });

  it("throws when hostname resolves to loopback", async () => {
    mockLookup([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      validateUrlAsync("https://rebind.attacker.com"),
    ).rejects.toThrow(AppError);
  });

  it("throws when hostname resolves to CGNAT range", async () => {
    mockLookup([{ address: "100.64.0.1", family: 4 }]);
    await expect(
      validateUrlAsync("https://cgnat.attacker.com"),
    ).rejects.toThrow(AppError);
  });

  it("throws when hostname resolves to private IPv6 ULA (fd prefix)", async () => {
    mockLookup([{ address: "fd00::1", family: 6 }]);
    await expect(
      validateUrlAsync("https://ipv6-rebind.attacker.com"),
    ).rejects.toThrow(AppError);
  });

  it("throws when dual-stack hostname has one private address among public ones", async () => {
    // The critical all:true case — any private address blocks the request
    mockLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "fd00::1", family: 6 },
    ]);
    await expect(
      validateUrlAsync("https://mixed.attacker.com"),
    ).rejects.toThrow(AppError);
  });

  it("passes when all resolved addresses are public", async () => {
    mockLookup([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
    await expect(
      validateUrlAsync("https://example.com"),
    ).resolves.toBeDefined();
  });

  it("throws when DNS lookup fails", async () => {
    mockLookup([], new Error("ENOTFOUND"));
    await expect(
      validateUrlAsync("https://nonexistent.invalid"),
    ).rejects.toThrow(AppError);
  });

  it("throws when DNS returns empty address list", async () => {
    mockLookup([]);
    await expect(validateUrlAsync("https://empty.invalid")).rejects.toThrow(
      AppError,
    );
  });

  it("skips DNS lookup for bare IPv4 literal blocked by sync check", async () => {
    await expect(validateUrlAsync("http://127.0.0.1")).rejects.toThrow(
      AppError,
    );
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("skips DNS lookup for bare IPv6 literal blocked by sync check", async () => {
    await expect(validateUrlAsync("http://[::1]")).rejects.toThrow(AppError);
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it("skips DNS lookup for valid public IPv4 literal", async () => {
    await expect(
      validateUrlAsync("http://93.184.216.34"),
    ).resolves.toBeDefined();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
});

describe("extractDomain", () => {
  it("extracts hostname from valid URL", () => {
    expect(extractDomain("https://example.com/path")).toBe("example.com");
  });

  it("returns empty string for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("");
  });
});

describe("secureLookup", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls callback with error when resolving to a private IP", (done) => {
    (dns.lookup as unknown as jest.Mock).mockImplementation(
      (_host: string, _opts: any, cb: Function) => {
        cb(null, "127.0.0.1", 4);
      },
    );

    secureLookup("evil.com", {}, (err: any, address: any, family: any) => {
      expect(err).toBeDefined();
      expect(err!.message).toContain("Access to private IP");
      done();
    });
  });

  it("calls callback with error when resolving to multiple addresses containing a private IP", (done) => {
    (dns.lookup as unknown as jest.Mock).mockImplementation(
      (_host: string, _opts: any, cb: Function) => {
        cb(
          null,
          [
            { address: "93.184.216.34", family: 4 },
            { address: "127.0.0.1", family: 4 },
          ],
          4,
        );
      },
    );

    secureLookup(
      "mixed.com",
      { all: true },
      (err: any, address: any, family: any) => {
        expect(err).toBeDefined();
        expect(err!.message).toContain("Access to private IP");
        done();
      },
    );
  });

  it("calls callback with success when resolving to a public IP", (done) => {
    (dns.lookup as unknown as jest.Mock).mockImplementation(
      (_host: string, _opts: any, cb: Function) => {
        cb(null, "93.184.216.34", 4);
      },
    );

    secureLookup("example.com", {}, (err: any, address: any, family: any) => {
      expect(err).toBeNull();
      expect(address).toBe("93.184.216.34");
      expect(family).toBe(4);
      done();
    });
  });
});

describe("secureAxios SSRF & Redirect validation", () => {
  it("throws error in beforeRedirect if host is a private IP literal", () => {
    const requestConfig = (getSecureAxios().interceptors.request as any)
      .handlers[0];
    const mockConfig: any = { beforeRedirect: null };

    const resolvedConfig = (requestConfig.fulfilled as Function)(mockConfig);
    expect(resolvedConfig.beforeRedirect).toBeDefined();

    expect(() => {
      resolvedConfig.beforeRedirect({ hostname: "127.0.0.1" });
    }).toThrow(/Redirect blocked/);

    expect(() => {
      resolvedConfig.beforeRedirect({ hostname: "192.168.1.1" });
    }).toThrow(/Redirect blocked/);

    expect(() => {
      resolvedConfig.beforeRedirect({ hostname: "example.com" });
    }).not.toThrow();
  });
});
