const MAX_SCAN_LENGTH = 100_000;

export class SensitiveScanService {
  /**
   * Returns true if any sensitive pattern matches in the given text.
   * Caps input length to 100KB to guarantee non-blocking regex execution on the event loop (SEC-26).
   */
  hasSensitiveData(text: string): boolean {
    if (!text || typeof text !== "string") {
      return false;
    }

    const target =
      text.length > MAX_SCAN_LENGTH ? text.slice(0, MAX_SCAN_LENGTH) : text;

    const patterns = [
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
      /(?<!\d)(\+84|0)(3[2-9]|5[2689]|7[06-9]|8[0-9]|9[0-9])\d{7}(?!\d)/,
      /(?<!\d)\d{12}(?!\d)/,
      /(?<!\d)\d{9,19}(?!\d)/,
    ];
    return patterns.some((pattern) => pattern.test(target));
  }
}
