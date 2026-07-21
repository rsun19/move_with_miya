export interface User {
  id: string;
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isTeacher: boolean;
  phoneNumber?: string;
  preferredName?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
}
