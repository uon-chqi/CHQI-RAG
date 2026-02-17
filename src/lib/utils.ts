import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Get or create a unique user ID stored in localStorage
 * Each browser/device gets their own persistent user ID
 */
export function getUserId(): string {
  const STORAGE_KEY = 'chqi_user_id';
  
  let userId = localStorage.getItem(STORAGE_KEY);
  
  if (!userId) {
    // Generate a unique ID for this user (web user + timestamp + random)
    userId = `web-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}
