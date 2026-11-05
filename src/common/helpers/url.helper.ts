import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import axios, { AxiosInstance } from "axios";
import { AppError } from "../errors/app-error";
import { ERROR_CODE } from "../errors/error-code";

// ---------------------------------------------------------------------------
// Static IP-based patterns (sync, fast path)
// ---------------------------------------------------------------------------

const PRIVATE_IP_PATTERNS: RegExp[] = [
  // --- IPv4 ---
  /^localhost$/i,
  /^127\./, // 127.0.0.0/8 — full loopback range
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // link-local + AWS metadata
  /^0\./, // 0.0.0.0/8 — maps to localhost on Linux and Unix systems
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 — CGNAT (RFC 6598)
  /^192\.0\.2\./, // 192.0.2.0/24 — TEST-NET-1 (RFC 5737)
  /^198\.51\.100\./, // 198.51.100.0/24 — TEST-NET-2 (RFC 5737)
  /^203\.0\.113\./, // 203.0.113.0/24 — TEST-NET-3 (RFC 5737)
  /^198\.1[89]\./, // 198.18.0.0/15 — benchmarking (RFC 2544)

  // --- IPv6 ---
  /^\[?::1\]?$/, // loopback
  /^\[?::\]?$/, // unspecified
  /^\[?fc[0-9a-f]{2}:/i, // ULA fc00::/7 (fc prefix)
  /^\[?fd[0-9a-f]{2}:/i, // ULA fd00::/8 (fd prefix)
  /^\[?fe[89ab][0-9a-f]:/i, // link-local fe80::/10
  /^\[?2001:db8:/i, // 2001:db8::/32 — documentation (RFC 3849)
  /^\[?ff[0-9a-f]{2}:/i, // ff00::/8 — multicast

  // IPv4-mapped IPv6 — block all ::ffff: mapped addresses, since legitimate
];

// Strict IPv4 literal check — validates each octet is 0-255.
// The naive /^\d{1,3}(\.\d{1,3}){3}$/ matches 999.999.999.999.

function isIPv4Literal(hostname: string): boolean {
  return /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
    hostname,
  );
}

/** IPv6 literal — bracketed or raw colon-hex form. */
function isIPv6Literal(hostname: string): boolean {
  return /^\[?[0-9a-f:]+\]?$/i.test(hostname);
}

function extractIpv4FromIpv6(stripped: string): string | null {
  // Dotted notation: ::ffff:192.168.1.1 or ::192.168.1.1
  const dotted = stripped.match(
    /^(?:0*:)*?(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
  );
  if (dotted) return dotted[1];

  // Colon-hex notation: ::a9fe:a9fe or ::ffff:a9fe:a9fe or 0:0:0:0:0:0:a9fe:a9fe
  const hex = stripped.match(
    /^(?:0*:)*?(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i,
  );
  if (hex) {
    const p1 = parseInt(hex[1], 16);
    const p2 = parseInt(hex[2], 16);
    const o1 = (p1 >> 8) & 0xff;
    const o2 = p1 & 0xff;
    const o3 = (p2 >> 8) & 0xff;
    const o4 = p2 & 0xff;
    return `${o1}.${o2}.${o3}.${o4}`;
  }
  return null;
}

export function checkAgainstPrivatePatterns(address: string): boolean {
  const stripped = address.replace(/^\[|\]$/g, "").toLowerCase();

  // 1. Extract embedded IPv4 from IPv4-mapped or IPv4-compatible IPv6
  const embeddedIpv4 = extractIpv4FromIpv6(stripped);
  if (embeddedIpv4) {
    if (PRIVATE_IP_PATTERNS.some((p) => p.test(embeddedIpv4))) {
      return true;
    }
  }

  // 2. Block all ::ffff: mapped space regardless
  if (stripped.startsWith("::ffff:")) {
    return true;
  }

  // 3. Block all IPv4-compatible IPv6 (::/96) space (deprecated & unused on public internet)
  if (/^::[0-9a-f.:]+$/i.test(stripped)) {
    return true;
  }

  return PRIVATE_IP_PATTERNS.some((p) => p.test(stripped));
}

// Sync validation — static IPs and protocol only.
// Cannot block DNS rebinding. Use validateUrlAsync() at every call site that
// accepts user-supplied URLs.

export function validateUrl(url: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("Invalid URL format", 400, ERROR_CODE.INVALID_URL);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError(
      "Only HTTP and HTTPS URLs are allowed",
      400,
      ERROR_CODE.INVALID_URL,
    );
  }

  const hostname = parsed.hostname;

  if (checkAgainstPrivatePatterns(hostname)) {
    throw new AppError(
      "Private or local IP addresses are not allowed",
      403,
      ERROR_CODE.PRIVATE_IP_BLOCKED,
    );
  }

  return parsed;
}

// Async validation — extends sync with DNS resolution.
// Uses { all: true } to resolve ALL addresses for a hostname (both IPv4 and
// IPv6). Blocks if ANY resolved address is private — prevents SSRF via DNS
// rebinding on dual-stack hosts.
// TOCTOU note: validate as close to the actual HTTP request as possible
// (i.e. inside the worker, not only at job creation time). DNS TTL can expire
// between validation and the Firecrawl request.

export async function validateUrlAsync(url: string): Promise<URL> {
  const parsed = validateUrl(url); // sync checks first

  const hostname = parsed.hostname;

  if (isIPv4Literal(hostname) || isIPv6Literal(hostname)) {
    return parsed;
  }

  const addresses = await new Promise<dns.LookupAddress[]>(
    (resolve, reject) => {
      dns.lookup(hostname, { all: true }, (err, addrs) => {
        if (err) {
          reject(
            new AppError("DNS resolution failed", 400, ERROR_CODE.INVALID_URL),
          );
        } else {
          resolve(addrs);
        }
      });
    },
  );

  if (addresses.length === 0) {
    throw new AppError(
      "DNS resolution returned no addresses",
      400,
      ERROR_CODE.INVALID_URL,
    );
  }

  for (const { address } of addresses) {
    if (checkAgainstPrivatePatterns(address)) {
      throw new AppError(
        "URL resolves to a private or reserved IP address",
        403,
        ERROR_CODE.PRIVATE_IP_BLOCKED,
      );
    }
  }

  return parsed;
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "";
  }
}

// Secure DNS lookup for private IP addresses
export type LookupFn = NonNullable<http.AgentOptions["lookup"]>;

export const secureLookup: LookupFn = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | dns.LookupAddress[],
    family: number,
  ) => void,
): void => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      return callback(err, address as string | dns.LookupAddress[], family);
    }

    if (Array.isArray(address)) {
      for (const addr of address) {
        if (checkAgainstPrivatePatterns(addr.address)) {
          return callback(
            new Error(
              `Access to private IP ${addr.address} is blocked`,
            ) as NodeJS.ErrnoException,
            [],
            0,
          );
        }
      }
      return callback(null, address, family);
    } else {
      if (address && checkAgainstPrivatePatterns(address)) {
        return callback(
          new Error(
            `Access to private IP ${address} is blocked`,
          ) as NodeJS.ErrnoException,
          "",
          0,
        );
      }
      return callback(null, address, family);
    }
  });
};

// HTTP agent with secure lookup for DNS resolution
export const secureHttpAgent = new http.Agent({
  keepAlive: true,
  lookup: secureLookup,
});

// HTTPS agent with secure lookup for DNS resolution
export const secureHttpsAgent = new https.Agent({
  keepAlive: true,
  lookup: secureLookup,
});

let secureAxiosInstance: AxiosInstance | null = null;

// Secure Axios instance with interceptors for SSRF and redirect validation
export function getSecureAxios(): AxiosInstance {
  if (!secureAxiosInstance) {
    const instance = axios.create({
      httpAgent: secureHttpAgent,
      httpsAgent: secureHttpsAgent,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit to prevent unbounded memory allocation / OOM DoS (SEC-29)
      maxBodyLength: 10 * 1024 * 1024,
    });

    if (!instance || !instance.interceptors) {
      return instance || axios;
    }

    instance.interceptors.request.use((config) => {
      if (config.url) {
        try {
          const parsed = new URL(config.url, config.baseURL);
          if (checkAgainstPrivatePatterns(parsed.hostname)) {
            throw new Error(
              `Access to private/local IP address ${parsed.hostname} is blocked`,
            );
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes("blocked")) {
            throw err;
          }
        }
      }

      (
        config as unknown as {
          beforeRedirect?: (opts: { hostname?: string }) => void;
        }
      ).beforeRedirect = (options: { hostname?: string }) => {
        if (options.hostname && checkAgainstPrivatePatterns(options.hostname)) {
          throw new Error(
            `Redirect blocked: host ${options.hostname} resolves to or is a private/local IP address`,
          );
        }
      };
      return config;
    });
    secureAxiosInstance = instance;
  }
  return secureAxiosInstance;
}
