# Project Context: Today Matters Turbo

## Overview
`todaymatters-turbo` is a **React Native (Expo)** application managed within a **TurboRepo** monorepo. It is designed to be a personal coaching or productivity app ("Today Matters") featuring voice interactions and persistent user data.

## Tech Stack
*   **Monorepo Management:** TurboRepo, pnpm
*   **Mobile Framework:** React Native (Expo SDK 54)
*   **Language:** TypeScript (100%)
*   **Styling:** NativeWind (Tailwind CSS) v4
*   **Routing:** Expo Router v6
*   **State Management:** Zustand (with persistence)
*   **Backend & Auth:** Supabase (Auth, Database, Realtime)
*   **Voice/AI:** ElevenLabs, LiveKit (WebRTC)

## Directory Structure

### Root
*   `apps/`: Contains the application code.
    *   `mobile/`: The main React Native/Expo application.
*   `packages/`: Shared configuration packages.
    *   `eslint-config/`: Shared ESLint rules.
    *   `typescript-config/`: Shared TSConfig bases.
*   `docs/`: Comprehensive documentation for features and setups (e.g., Supabase, ElevenLabs).
*   `supabase/`: Supabase CLI configuration, migrations, and edge functions.

### Mobile App (`apps/mobile`)
*   `src/app/`: Expo Router screens and layouts.
*   `src/components/`: Reusable UI components (Atomic Design: atoms, molecules, etc.).
*   `src/hooks/`: Custom React hooks (e.g., `use-auth.ts`).
*   `src/lib/`: External service integrations (Supabase, ElevenLabs).
*   `src/stores/`: Zustand state stores (e.g., `auth-store.ts`).

## Development Workflow

### Prerequisites
*   Node.js (>=18)
*   pnpm (v9+)
*   Supabase project credentials

### Setup
1.  **Install dependencies:**
    ```bash
    pnpm install
    ```
2.  **Environment Variables:**
    Create a `.env` file in `apps/mobile/` based on `.env.example`:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
    ```

### Running the App
*   **Start Development Server:**
    ```bash
    # From root
    pnpm dev -- --filter=mobile
    
    # OR specifically for mobile
    cd apps/mobile && pnpm dev
    ```
*   **Run on Android Emulator:**
    ```bash
    pnpm --filter mobile android
    ```
*   **Run on iOS Simulator:**
    ```bash
    pnpm --filter mobile ios
    ```

### Building
*   **Build all packages:**
    ```bash
    pnpm build
    ```

## Key Features & Integrations
*   **Authentication:** Managed via Supabase Auth with auto-refreshing sessions stored in `AsyncStorage`.
*   **Voice Coach:** Integrates ElevenLabs and LiveKit for real-time voice conversations.
*   **Deep Linking:** Configured with scheme `todaymatters://` for OAuth redirects.
*   **Native Modules:** Uses Expo managed workflow; native code generation via `npx expo prebuild`.

## Common Tasks
*   **Linting:** `pnpm lint`
*   **Type Checking:** `pnpm check-types`
*   **Formatting:** `pnpm format`

## Useful Documentation
*   `docs/setup-summary.md`: Detailed setup status and architecture decisions.
*   `docs/supabase-integration.md`: Guide for backend integration.
*   `docs/elevenlabs-voice-agent-integration.md`: Voice feature details.
