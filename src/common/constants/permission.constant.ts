import { SYSTEM_ROLE_SLUGS, SystemRoleSlug } from "./system-role.constant";

export const PERMISSIONS = {
  // Users
  USERS_READ: "users.read",
  USERS_CREATE: "users.create",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
  USERS_ROLES_READ: "users.roles.read",
  USERS_ROLES_ASSIGN: "users.roles.assign",

  // Roles
  ROLES_READ: "roles.read",
  ROLES_CREATE: "roles.create",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  ROLES_PERMISSIONS_READ: "roles.permissions.read",
  ROLES_PERMISSIONS_ASSIGN: "roles.permissions.assign",

  // Permissions
  PERMISSIONS_READ: "permissions.read",

  // Crawl Jobs
  CRAWL_JOBS_CREATE: "crawl_jobs.create",
  CRAWL_JOBS_READ: "crawl_jobs.read",
  CRAWL_JOBS_READ_ALL: "crawl_jobs.read_all",
  CRAWL_JOBS_CANCEL: "crawl_jobs.cancel",
  CRAWL_JOBS_RETRY: "crawl_jobs.retry",
  CRAWL_JOBS_DELETE: "crawl_jobs.delete",

  // Crawl Schedules
  CRAWL_SCHEDULES_CREATE: "crawl_schedules.create",
  CRAWL_SCHEDULES_READ: "crawl_schedules.read",
  CRAWL_SCHEDULES_READ_ALL: "crawl_schedules.read_all",
  CRAWL_SCHEDULES_UPDATE: "crawl_schedules.update",
  CRAWL_SCHEDULES_DELETE: "crawl_schedules.delete",
  CRAWL_SCHEDULES_RUN: "crawl_schedules.run",

  // Exports
  EXPORTS_READ: "exports.read",
  EXPORTS_READ_ALL: "exports.read_all",
  EXPORTS_CREATE: "exports.create",
  EXPORTS_DOWNLOAD: "exports.download",

  // Audit Logs
  AUDIT_LOGS_READ: "audit_logs.read",

  // Dashboard
  DASHBOARD_READ: "dashboard.read",
  DASHBOARD_READ_ALL: "dashboard.read_all",
} as const;

export type PermissionSlug = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  name: string;
  slug: PermissionSlug;
  description: string;
  resource: string;
  action: string;
  isSystem: boolean;
}

export const SYSTEM_PERMISSIONS_CATALOG: PermissionDefinition[] = [
  // Users
  {
    name: "View Users",
    slug: PERMISSIONS.USERS_READ,
    description: "Xem danh sách và thông tin người dùng",
    resource: "users",
    action: "read",
    isSystem: true,
  },
  {
    name: "Create User",
    slug: PERMISSIONS.USERS_CREATE,
    description: "Tạo tài khoản người dùng mới",
    resource: "users",
    action: "create",
    isSystem: true,
  },
  {
    name: "Update User",
    slug: PERMISSIONS.USERS_UPDATE,
    description: "Cập nhật thông tin và định mức tài nguyên của người dùng",
    resource: "users",
    action: "update",
    isSystem: true,
  },
  {
    name: "Delete User",
    slug: PERMISSIONS.USERS_DELETE,
    description: "Xóa hoặc vô hiệu hóa tài khoản người dùng",
    resource: "users",
    action: "delete",
    isSystem: true,
  },
  {
    name: "View User Roles",
    slug: PERMISSIONS.USERS_ROLES_READ,
    description: "Xem danh sách vai trò được gán cho người dùng",
    resource: "users",
    action: "roles.read",
    isSystem: true,
  },
  {
    name: "Assign User Roles",
    slug: PERMISSIONS.USERS_ROLES_ASSIGN,
    description: "Gán hoặc thu hồi vai trò của người dùng",
    resource: "users",
    action: "roles.assign",
    isSystem: true,
  },

  // Roles
  {
    name: "View Roles",
    slug: PERMISSIONS.ROLES_READ,
    description: "Xem danh sách và chi tiết vai trò",
    resource: "roles",
    action: "read",
    isSystem: true,
  },
  {
    name: "Create Role",
    slug: PERMISSIONS.ROLES_CREATE,
    description: "Tạo vai trò tùy chỉnh mới",
    resource: "roles",
    action: "create",
    isSystem: true,
  },
  {
    name: "Update Role",
    slug: PERMISSIONS.ROLES_UPDATE,
    description: "Cập nhật thông tin vai trò tùy chỉnh",
    resource: "roles",
    action: "update",
    isSystem: true,
  },
  {
    name: "Delete Role",
    slug: PERMISSIONS.ROLES_DELETE,
    description: "Xóa vai trò tùy chỉnh",
    resource: "roles",
    action: "delete",
    isSystem: true,
  },
  {
    name: "View Role Permissions",
    slug: PERMISSIONS.ROLES_PERMISSIONS_READ,
    description: "Xem danh sách quyền hạn được gán cho vai trò",
    resource: "roles",
    action: "permissions.read",
    isSystem: true,
  },
  {
    name: "Assign Role Permissions",
    slug: PERMISSIONS.ROLES_PERMISSIONS_ASSIGN,
    description: "Gán hoặc thu hồi quyền hạn của vai trò",
    resource: "roles",
    action: "permissions.assign",
    isSystem: true,
  },

  // Permissions
  {
    name: "View Permissions Registry",
    slug: PERMISSIONS.PERMISSIONS_READ,
    description: "Xem danh mục quyền hạn có trong hệ thống",
    resource: "permissions",
    action: "read",
    isSystem: true,
  },

  // Crawl Jobs
  {
    name: "Create Crawl Job",
    slug: PERMISSIONS.CRAWL_JOBS_CREATE,
    description: "Khởi tạo tác vụ cào dữ liệu",
    resource: "crawl_jobs",
    action: "create",
    isSystem: true,
  },
  {
    name: "View Own Crawl Jobs",
    slug: PERMISSIONS.CRAWL_JOBS_READ,
    description: "Xem các tác vụ cào dữ liệu của chính mình",
    resource: "crawl_jobs",
    action: "read",
    isSystem: true,
  },
  {
    name: "View All Crawl Jobs",
    slug: PERMISSIONS.CRAWL_JOBS_READ_ALL,
    description: "Xem tất cả tác vụ cào dữ liệu trong hệ thống (Admin)",
    resource: "crawl_jobs",
    action: "read_all",
    isSystem: true,
  },
  {
    name: "Cancel Crawl Job",
    slug: PERMISSIONS.CRAWL_JOBS_CANCEL,
    description: "Hủy tác vụ cào dữ liệu đang thực thi",
    resource: "crawl_jobs",
    action: "cancel",
    isSystem: true,
  },
  {
    name: "Retry Crawl Job",
    slug: PERMISSIONS.CRAWL_JOBS_RETRY,
    description: "Chạy lại tác vụ cào dữ liệu bị lỗi",
    resource: "crawl_jobs",
    action: "retry",
    isSystem: true,
  },
  {
    name: "Delete Crawl Job",
    slug: PERMISSIONS.CRAWL_JOBS_DELETE,
    description: "Xóa bản ghi tác vụ cào dữ liệu",
    resource: "crawl_jobs",
    action: "delete",
    isSystem: true,
  },

  // Crawl Schedules
  {
    name: "Create Crawl Schedule",
    slug: PERMISSIONS.CRAWL_SCHEDULES_CREATE,
    description: "Thiết lập lịch cào dữ liệu định kỳ",
    resource: "crawl_schedules",
    action: "create",
    isSystem: true,
  },
  {
    name: "View Own Crawl Schedules",
    slug: PERMISSIONS.CRAWL_SCHEDULES_READ,
    description: "Xem lịch cào dữ liệu của chính mình",
    resource: "crawl_schedules",
    action: "read",
    isSystem: true,
  },
  {
    name: "View All Crawl Schedules",
    slug: PERMISSIONS.CRAWL_SCHEDULES_READ_ALL,
    description: "Xem toàn bộ lịch cào dữ liệu trong hệ thống (Admin)",
    resource: "crawl_schedules",
    action: "read_all",
    isSystem: true,
  },
  {
    name: "Update Crawl Schedule",
    slug: PERMISSIONS.CRAWL_SCHEDULES_UPDATE,
    description: "Chỉnh sửa cấu hình lịch cào dữ liệu",
    resource: "crawl_schedules",
    action: "update",
    isSystem: true,
  },
  {
    name: "Delete Crawl Schedule",
    slug: PERMISSIONS.CRAWL_SCHEDULES_DELETE,
    description: "Xóa lịch cào dữ liệu định kỳ",
    resource: "crawl_schedules",
    action: "delete",
    isSystem: true,
  },
  {
    name: "Run Crawl Schedule Manually",
    slug: PERMISSIONS.CRAWL_SCHEDULES_RUN,
    description: "Kích hoạt chạy ngay một lịch cào dữ liệu",
    resource: "crawl_schedules",
    action: "run",
    isSystem: true,
  },

  // Exports
  {
    name: "View Own Exports",
    slug: PERMISSIONS.EXPORTS_READ,
    description: "Xem danh sách file trích xuất của chính mình",
    resource: "exports",
    action: "read",
    isSystem: true,
  },
  {
    name: "View All Exports",
    slug: PERMISSIONS.EXPORTS_READ_ALL,
    description: "Xem danh sách file trích xuất toàn hệ thống",
    resource: "exports",
    action: "read_all",
    isSystem: true,
  },
  {
    name: "Create Export",
    slug: PERMISSIONS.EXPORTS_CREATE,
    description: "Tạo file trích xuất dữ liệu",
    resource: "exports",
    action: "create",
    isSystem: true,
  },
  {
    name: "Download Export",
    slug: PERMISSIONS.EXPORTS_DOWNLOAD,
    description: "Tải file trích xuất về máy",
    resource: "exports",
    action: "download",
    isSystem: true,
  },

  // Audit Logs
  {
    name: "View Audit Logs",
    slug: PERMISSIONS.AUDIT_LOGS_READ,
    description: "Tra cứu nhật ký kiểm tra an toàn hệ thống",
    resource: "audit_logs",
    action: "read",
    isSystem: true,
  },

  // Dashboard
  {
    name: "View Dashboard",
    slug: PERMISSIONS.DASHBOARD_READ,
    description: "Xem bảng thông số tổng quan cá nhân",
    resource: "dashboard",
    action: "read",
    isSystem: true,
  },
  {
    name: "View Global Dashboard",
    slug: PERMISSIONS.DASHBOARD_READ_ALL,
    description: "Xem bảng thông số toàn diện của toàn hệ thống",
    resource: "dashboard",
    action: "read_all",
    isSystem: true,
  },
];

export const SYSTEM_ROLE_DEFAULT_PERMISSIONS: Record<
  SystemRoleSlug,
  PermissionSlug[]
> = {
  [SYSTEM_ROLE_SLUGS.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [SYSTEM_ROLE_SLUGS.ADMIN]: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_ROLES_READ,
    PERMISSIONS.USERS_ROLES_ASSIGN,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_CREATE,
    PERMISSIONS.ROLES_UPDATE,
    PERMISSIONS.ROLES_DELETE,
    PERMISSIONS.ROLES_PERMISSIONS_READ,
    PERMISSIONS.ROLES_PERMISSIONS_ASSIGN,
    PERMISSIONS.PERMISSIONS_READ,
    PERMISSIONS.CRAWL_JOBS_CREATE,
    PERMISSIONS.CRAWL_JOBS_READ,
    PERMISSIONS.CRAWL_JOBS_READ_ALL,
    PERMISSIONS.CRAWL_JOBS_CANCEL,
    PERMISSIONS.CRAWL_JOBS_RETRY,
    PERMISSIONS.CRAWL_JOBS_DELETE,
    PERMISSIONS.CRAWL_SCHEDULES_CREATE,
    PERMISSIONS.CRAWL_SCHEDULES_READ,
    PERMISSIONS.CRAWL_SCHEDULES_READ_ALL,
    PERMISSIONS.CRAWL_SCHEDULES_UPDATE,
    PERMISSIONS.CRAWL_SCHEDULES_DELETE,
    PERMISSIONS.CRAWL_SCHEDULES_RUN,
    PERMISSIONS.EXPORTS_READ,
    PERMISSIONS.EXPORTS_READ_ALL,
    PERMISSIONS.EXPORTS_CREATE,
    PERMISSIONS.EXPORTS_DOWNLOAD,
    PERMISSIONS.AUDIT_LOGS_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.DASHBOARD_READ_ALL,
  ],
  [SYSTEM_ROLE_SLUGS.CRAWLER_USER]: [
    PERMISSIONS.CRAWL_JOBS_CREATE,
    PERMISSIONS.CRAWL_JOBS_READ,
    PERMISSIONS.CRAWL_JOBS_CANCEL,
    PERMISSIONS.CRAWL_JOBS_RETRY,
    PERMISSIONS.CRAWL_SCHEDULES_CREATE,
    PERMISSIONS.CRAWL_SCHEDULES_READ,
    PERMISSIONS.CRAWL_SCHEDULES_UPDATE,
    PERMISSIONS.CRAWL_SCHEDULES_DELETE,
    PERMISSIONS.CRAWL_SCHEDULES_RUN,
    PERMISSIONS.EXPORTS_READ,
    PERMISSIONS.EXPORTS_CREATE,
    PERMISSIONS.EXPORTS_DOWNLOAD,
    PERMISSIONS.DASHBOARD_READ,
  ],
  [SYSTEM_ROLE_SLUGS.VIEWER]: [
    PERMISSIONS.CRAWL_JOBS_READ,
    PERMISSIONS.CRAWL_SCHEDULES_READ,
    PERMISSIONS.EXPORTS_READ,
    PERMISSIONS.DASHBOARD_READ,
  ],
};
