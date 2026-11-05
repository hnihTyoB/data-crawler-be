import { ROLES } from "../constants/role.constant";
import { SYSTEM_ROLE_SLUGS } from "../constants/system-role.constant";

export interface UserAuthContext {
  role?: string;
  roles?: string[];
  permissions?: string[];
}

/**
 * Kiểm tra xem người dùng có quyền Quản trị viên (Admin / Super Admin) hay không.
 * Hỗ trợ đồng bộ cả vai trò kế thừa (legacy role string: ADMIN)
 * lẫn hệ thống RBAC động đa vai trò (dynamic roles: admin, super_admin).
 */
export function hasAdminPrivilege(
  userOrRole?: UserAuthContext | string | null,
  roles?: string[],
): boolean {
  if (!userOrRole) return false;

  if (typeof userOrRole === "string") {
    const normalized = userOrRole.toLowerCase();
    if (normalized === "admin" || normalized === "super_admin") {
      return true;
    }
    const normalizedRoles = roles?.map((r) => r.toLowerCase());
    if (
      normalizedRoles?.includes(SYSTEM_ROLE_SLUGS.ADMIN) ||
      normalizedRoles?.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      return true;
    }
    return false;
  }

  const normalizedRole = userOrRole.role?.toLowerCase();
  if (normalizedRole === "admin" || normalizedRole === "super_admin") {
    return true;
  }

  const assignedRoles = (userOrRole.roles ?? roles)?.map((r) =>
    r.toLowerCase(),
  );
  if (
    assignedRoles?.includes(SYSTEM_ROLE_SLUGS.ADMIN) ||
    assignedRoles?.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
  ) {
    return true;
  }

  if (
    userOrRole.permissions?.includes("crawl_jobs.manage_all") ||
    userOrRole.permissions?.includes("crawl_schedules.manage_all")
  ) {
    return true;
  }

  return false;
}
