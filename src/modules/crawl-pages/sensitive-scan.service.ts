export class SensitiveScanService {
  /**
   * Returns true if any sensitive pattern matches in the given text.
   */
  hasSensitiveData(text: string): boolean {
    const patterns = [
      /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
      /(?<!\d)(\+84|0)(3[2-9]|5[2689]|7[06-9]|8[0-9]|9[0-9])\d{7}(?!\d)/,
      /(?<!\d)\d{12}(?!\d)/,
      /(?<!\d)\d{9,19}(?!\d)/,
    ];
    return patterns.some((pattern) => pattern.test(text));
  }
}