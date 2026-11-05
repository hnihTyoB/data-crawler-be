export const parseTrustProxy = (value: string): boolean | number | string => {
  const lowercaseVal = value.trim().toLowerCase();
  // When configured as "true", default to 1 (single reverse proxy hop) to prevent
  // Express from blindly trusting the leftmost client-forged IP in X-Forwarded-For (SEC-09).
  if (lowercaseVal === "true") return 1;
  if (lowercaseVal === "false") return false;

  const parsed = parseInt(lowercaseVal, 10);
  if (!isNaN(parsed) && String(parsed) === value.trim()) {
    return parsed;
  }
  return value.trim();
};
