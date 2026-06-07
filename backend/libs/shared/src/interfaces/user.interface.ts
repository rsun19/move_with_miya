export interface User {
  id: number;
  email: string;
  isAdmin: boolean;
  firstName: string;
  lastName?: string;
  permissions?: string;
  isTeacher?: boolean;
  joinDate?: string;
}
