import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  persist(
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
          const {
            data: { session },
          } = await supabase.auth.getSession();
          get().setSession(session);

          const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist user and session, not loading states
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
