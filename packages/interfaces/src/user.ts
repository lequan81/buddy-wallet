export interface SafeUser {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
  emailVerified?: boolean;
  emailNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  mustChangePassword?: boolean;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
}

export interface UserResult {
  success: boolean;
  error?: string;
  user?: SafeUser;
  users?: SafeUser[];
  isActive?: boolean;
  permissions?: string[];
  message?: string;
}
