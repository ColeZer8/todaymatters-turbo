export { supabase } from './client';
export {
  createSessionFromUrl,
  performOAuth,
  sendMagicLink,
  handleAuthCallback,
  resendEmailConfirmation,
} from './auth';
export {
  refreshSession,
  getValidSession,
  isTokenExpiringSoon,
  REFRESH_ERRORS,
} from './session';
export { SecureStorage } from './secure-storage';
export { migrateSessionToSecureStorage, needsMigration } from './migration';