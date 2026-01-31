/**
 * User Type Definitions
 */
export interface SafeUser {
  id: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UserResult {
  success: boolean;
  error?: string;
  user?: SafeUser;
  users?: SafeUser[];
  isActive?: boolean;
  permissions?: string[];
}
