export const parseTrustProxy = (value: string): boolean | number | string => {
  const lowercaseVal = value.trim().toLowerCase();
  if (lowercaseVal === 'true') return true;
  if (lowercaseVal === 'false') return false;

  const parsed = parseInt(lowercaseVal, 10);
  if (!isNaN(parsed) && String(parsed) === value.trim()) {
    return parsed;
  }
  return value;
};
