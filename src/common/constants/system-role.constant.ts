export const SYSTEM_ROLE_SLUGS = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  CRAWLER_USER: "crawler_user",
  VIEWER: "viewer",
} as const;

export type SystemRoleSlug =
  (typeof SYSTEM_ROLE_SLUGS)[keyof typeof SYSTEM_ROLE_SLUGS];

export interface SystemRoleDefinition {
  name: string;
  slug: SystemRoleSlug;
  description: string;
  isSystem: boolean;
}

export const SYSTEM_ROLES_METADATA: Record<
  SystemRoleSlug,
  SystemRoleDefinition
> = {
  [SYSTEM_ROLE_SLUGS.SUPER_ADMIN]: {
    name: "Super Administrator",
    slug: SYSTEM_ROLE_SLUGS.SUPER_ADMIN,
    description:
      "Tài khoản quản trị cấp cao nhất, toàn quyền quản lý hệ thống, vai trò và phân quyền.",
    isSystem: true,
  },
  [SYSTEM_ROLE_SLUGS.ADMIN]: {
    name: "Administrator",
    slug: SYSTEM_ROLE_SLUGS.ADMIN,
    description:
      "Quản trị viên vận hành hệ thống, quản lý người dùng, job, lịch trình và custom roles.",
    isSystem: true,
  },
  [SYSTEM_ROLE_SLUGS.CRAWLER_USER]: {
    name: "Crawler User",
    slug: SYSTEM_ROLE_SLUGS.CRAWLER_USER,
    description:
      "Người dùng thông thường, có quyền tạo và quản lý tác vụ cào dữ liệu của chính mình.",
    isSystem: true,
  },
  [SYSTEM_ROLE_SLUGS.VIEWER]: {
    name: "Viewer",
    slug: SYSTEM_ROLE_SLUGS.VIEWER,
    description:
      "Người dùng chỉ có quyền xem dữ liệu và kết quả báo cáo cào dữ liệu.",
    isSystem: true,
  },
};
