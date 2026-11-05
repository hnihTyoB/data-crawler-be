import {
  revokeToken,
  revokeUserTokens,
  isTokenRevoked,
  clearLocalTokenBlocklist,
} from "../token-blocklist.helper";

describe("TokenBlocklistHelper", () => {
  beforeEach(() => {
    clearLocalTokenBlocklist();
  });

  describe("Individual token revocation", () => {
    it("should mark a specific token as revoked", async () => {
      const token = "header.payload.signature-1";
      const otherToken = "header.payload.signature-2";

      expect(await isTokenRevoked(token, "user-1", 100)).toBe(false);

      await revokeToken(token);

      expect(await isTokenRevoked(token, "user-1", 100)).toBe(true);
      expect(await isTokenRevoked(otherToken, "user-1", 100)).toBe(false);
    });
  });

  describe("User-level token revocation", () => {
    it("should revoke tokens issued before the revocation timestamp", async () => {
      const user = "user-abc";
      const token = "some.jwt.token";

      // Revoke all tokens issued before t=500
      await revokeUserTokens(user, 3600, 500);

      // Prior token (iat=499) is revoked
      expect(await isTokenRevoked(token, user, 499)).toBe(true);

      // Token issued at exact revocation timestamp (iat=500) is valid (for newly issued token in same second)
      expect(await isTokenRevoked(token, user, 500)).toBe(false);

      // Token issued after revocation timestamp (iat=501) is valid
      expect(await isTokenRevoked(token, user, 501)).toBe(false);

      // Different user is unaffected
      expect(await isTokenRevoked(token, "other-user", 499)).toBe(false);
    });
  });
});
