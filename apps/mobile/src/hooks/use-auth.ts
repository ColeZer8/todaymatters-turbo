import { useEffect } from 'react';
import { useAuthStore } from '@/stores';

/**
 * Hook for accessing authentication state and actions.
 * Automatically initializes auth on mount.
 *
 * @example
 * ```tsx
 * const { user, isAuthenticated, signIn, signOut } = useAuth();
 * ```
 */
export const useAuth = () => {
  const store = useAuthStore();

  useEffect(() => {
    // Initialize auth state on mount
    store.initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return {
    user: store.user,
    session: store.session,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
  };
};

