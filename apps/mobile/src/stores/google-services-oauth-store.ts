import { create } from "zustand";
import type { GoogleOAuthResult } from "@/lib/google-services-oauth";

interface GoogleServicesOAuthState {
  isProcessing: boolean;
  result: GoogleOAuthResult | null;
  setProcessing: (value: boolean) => void;
  setResult: (result: GoogleOAuthResult | null) => void;
  clearResult: () => void;
}

export const useGoogleServicesOAuthStore = create<GoogleServicesOAuthState>(
  (set) => ({
    isProcessing: false,
    result: null,
    setProcessing: (value) => set({ isProcessing: value }),
    setResult: (result) => set({ result, isProcessing: false }),
    clearResult: () => set({ result: null }),
  }),
);
