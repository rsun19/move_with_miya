export const UserRole = {
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
  TEACHER: 'TEACHER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
