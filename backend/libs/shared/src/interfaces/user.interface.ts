export interface UserPreferences {
  receiveNewsletter: boolean;
  receiveClassNotifications: {
    email: boolean;
    sms: boolean;
  };
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  isTeacher: boolean;
  preferences: UserPreferences;
  joinDate: Date;
  permissions?: string[];
  phoneNumber?: string;
  preferredName?: string;
  middleName?: string;
  lastName?: string;
}
