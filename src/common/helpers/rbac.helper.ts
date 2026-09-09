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
    if (userOrRole === ROLES.ADMIN) {
      return true;
    }
    if (
      roles?.includes(SYSTEM_ROLE_SLUGS.ADMIN) ||
      roles?.includes(SYSTEM_ROLE_SLUGS.SUPER_ADMIN)
    ) {
      return true;
    }
    return false;
  }

  if (userOrRole.role === ROLES.ADMIN) {
    return true;
  }

  const assignedRoles = userOrRole.roles ?? roles;
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
