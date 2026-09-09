import { hasAdminPrivilege } from "../rbac.helper";
import { ROLES } from "../../constants/role.constant";
import { SYSTEM_ROLE_SLUGS } from "../../constants/system-role.constant";

describe("rbac.helper - hasAdminPrivilege", () => {
  it("returns true for legacy string role ADMIN", () => {
    expect(hasAdminPrivilege(ROLES.ADMIN)).toBe(true);
  });

  it("returns false for legacy string role VIEWER or CRAWLER_USER without admin dynamic roles", () => {
    expect(hasAdminPrivilege(ROLES.VIEWER)).toBe(false);
    expect(hasAdminPrivilege(ROLES.CRAWLER_USER)).toBe(false);
  });

  it("returns true if roles array contains admin or super_admin", () => {
    expect(
      hasAdminPrivilege(ROLES.CRAWLER_USER, [SYSTEM_ROLE_SLUGS.ADMIN]),
    ).toBe(true);
    expect(
      hasAdminPrivilege(ROLES.VIEWER, [SYSTEM_ROLE_SLUGS.SUPER_ADMIN]),
    ).toBe(true);
  });

  it("returns true for user context object with dynamic admin roles", () => {
    expect(
      hasAdminPrivilege({
        role: ROLES.CRAWLER_USER,
        roles: [SYSTEM_ROLE_SLUGS.ADMIN],
      }),
    ).toBe(true);
  });

  it("returns false for user context object with regular roles", () => {
    expect(
      hasAdminPrivilege({
        role: ROLES.CRAWLER_USER,
        roles: [SYSTEM_ROLE_SLUGS.CRAWLER_USER],
      }),
    ).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(hasAdminPrivilege(null)).toBe(false);
    expect(hasAdminPrivilege(undefined)).toBe(false);
  });
});
