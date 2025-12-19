import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // Actions
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<{ session: Session | null; user: User | null }>;
  signUp: (email: string, password: string) => Promise<{ session: Session | null; user: User | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<(() => void) | undefined>;
}

// Use the app's deep link scheme for email confirmation redirects
// Supabase will verify the token server-side, then redirect to this URL
// The app will handle the deep link and complete the authentication
const emailRedirectTo = 'todaymatters://auth/confirm';

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,

    setSession: (session) => {
      set({
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
      });
    },

    setUser: (user) => {
      set({
        user,
        isAuthenticated: !!user,
      });
    },

    signIn: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        get().setSession(data.session);
        return { session: data.session, user: data.user };
      } catch (error) {
        set({ isLoading: false });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    signUp: async (email: string, password: string) => {
      set({ isLoading: true });
      try {
        // Supabase will handle email confirmation server-side
        // After verification, it redirects to our app's deep link
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: emailRedirectTo,
          },
        });

        if (error) throw error;

        get().setSession(data.session);
        return { session: data.session, user: data.user };
      } catch (error) {
        set({ isLoading: false });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    signOut: async () => {
      set({ isLoading: true });
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        get().setSession(null);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    },

    initialize: async () => {
      set({ isLoading: true });
      try {
        // Check for auth bypass environment variable (for testing)
        const bypassAuth = process.env.EXPO_PUBLIC_BYPASS_AUTH === 'true';
        console.log('🔍 Auth bypass check:', {
          envValue: process.env.EXPO_PUBLIC_BYPASS_AUTH,
          bypassAuth,
        });

        if (bypassAuth) {
          console.log('⚠️ Auth bypass is enabled for testing');
          // Create a mock session for bypass mode
          get().setSession({
            user: {
              id: 'test-user-bypass',
              email: 'test@bypass.local',
              aud: 'authenticated',
              role: 'authenticated',
              created_at: new Date().toISOString(),
            },
            access_token: 'bypass-token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Date.now() + 3600000,
            refresh_token: 'bypass-refresh',
          } as Session);
          set({ isLoading: false });
          return undefined;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Only update store if Supabase has a session. We don't clear on init; we clear on SIGNED_OUT.
        if (session) {
          get().setSession(session);
        }

        if (__DEV__) {
          console.log('🔍 Supabase getSession():', {
            hasSession: !!session,
            userId: session?.user?.id ?? null,
            expiresAt: session?.expires_at ?? null,
          });
        }

        const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
          if (__DEV__) {
            console.log('🔍 Supabase onAuthStateChange:', {
              event,
              hasSession: !!nextSession,
              userId: nextSession?.user?.id ?? null,
              expiresAt: nextSession?.expires_at ?? null,
            });
          }

          if (event === 'SIGNED_OUT') {
            get().setSession(null);
            return;
          }

          // For SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.
          get().setSession(nextSession);
        });

        return () => {
          subscription?.subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        set({ isLoading: false });
      }
      return undefined;
    },
  })
);
