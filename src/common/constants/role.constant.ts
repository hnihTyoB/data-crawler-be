export const ROLES = {
  ADMIN: 'ADMIN',
  CRAWLER_USER: 'CRAWLER_USER',
  VIEWER: 'VIEWER',
} as const;

export type Role = keyof typeof ROLES;
