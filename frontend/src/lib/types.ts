export interface Location {
  id: number;
  name?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: string;
}

export interface YogaClass {
  id: number;
  name: string;
  teacherIds: string[];
  capacity: number;
  cost: string;
  description: string;
  duration: number;
  imageUrl?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  locationId: number;
  location: Location;
  isPrivate: boolean;
  registrationCount?: number;
  teachers?: Teacher[];
}

export type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER' | 'TEACHER';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: UserRole;
  phoneNumber?: string | null;
  preferredName?: string | null;
  yogaExperience?: string | null;
  banned?: boolean;
}

export interface Registration {
  id: number;
  userId: string;
  classId: number;
  status: string;
  registeredAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role: string;
  } | null;
}

export interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: string;
  banned: boolean;
}
