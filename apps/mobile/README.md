# TodayMatters Mobile App

A cross-platform mobile productivity app built with Expo, React Native, Supabase, and TypeScript.

## Tech Stack

- **Framework**: Expo Router (React Native)
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Supabase (Auth, Database, Storage, Real-time)
- **State Management**: Zustand
- **Monorepo**: Turborepo

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 9.0.0+
- Expo CLI (optional, can use `pnpm` commands)
- Supabase account (for backend services)

### Installation

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Start the development server**:
   ```bash
   pnpm dev -- --filter=mobile
   ```

   Or run directly:
   ```bash
   pnpm --filter mobile start
   ```

### Running on Devices

- **iOS Simulator**: `pnpm --filter mobile ios`
- **Android Emulator**: `pnpm --filter mobile android`
- **Web**: `pnpm --filter mobile web`

## Project Structure

```
apps/mobile/
├── src/
│   ├── app/              # Expo Router screens (Pages layer)
│   ├── components/       # UI components (Atoms → Molecules → Organisms → Templates)
│   ├── hooks/            # Shared React hooks
│   ├── lib/               # Utilities and third-party integrations
│   │   ├── supabase/     # Supabase client and auth utilities
│   │   └── storage/       # Storage utilities
│   ├── stores/            # Zustand state management stores
│   └── types/             # Shared TypeScript types
├── app.json              # Expo configuration
├── babel.config.js        # Babel configuration
├── metro.config.js        # Metro bundler configuration
└── tailwind.config.js     # Tailwind CSS configuration
```

## Key Features

### Authentication

The app uses Supabase Auth with support for:
- Email/Password authentication
- Magic Link (OTP) authentication
- OAuth providers (Google, Apple, GitHub, etc.)
- Session persistence with AsyncStorage
- Deep linking for OAuth callbacks

**Usage**:
```tsx
import { useAuth } from '@/hooks';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  
  // Use auth state and actions
}
```

### State Management

Zustand stores are located in `src/stores/`:
- `auth-store.ts`: Authentication state and actions

**Usage**:
```tsx
import { useAuthStore } from '@/stores';

const user = useAuthStore((state) => state.user);
const signIn = useAuthStore((state) => state.signIn);
```

### Database Queries

Use the Supabase client for database operations:

```tsx
import { supabase } from '@/lib/supabase';

// Fetch data
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_id', userId);
```

## Development

### Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with shared configs from `@repo/eslint-config`
- **Formatting**: Prettier 3
- **Atomic Design**: Components organized by layer (atoms → molecules → organisms → templates → pages)

### Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm check-types` - Type check with TypeScript
- `pnpm format` - Format code with Prettier

## Documentation

- [Supabase Integration Guide](/docs/supabase-integration.md)
- [Native Modules Guide](/docs/native-modules.md)
- [Atomic Design Principles](/docs/atomic-design.md)

## Deployment

### EAS Build

Build native apps with EAS:

```bash
pnpm --filter mobile deploy
```

This runs:
1. `expo export -p web` - Export web build
2. `eas-cli deploy` - Deploy to app stores

### Environment Variables

For production builds, set environment variables in EAS:
```bash
eas build:configure
```

Or use EAS Secrets:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value your-url
```

## Troubleshooting

### Metro Bundler Issues

Clear cache and restart:
```bash
pnpm --filter mobile start --clear
```

### Type Errors

Ensure TypeScript can resolve path aliases. The `@/` alias is configured in:
- `tsconfig.json` (for TypeScript)
- `babel.config.js` (for Metro bundler)

### Supabase Connection Issues

1. Verify `.env` file has correct values
2. Check Supabase project is active
3. Ensure network allows connections to Supabase

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Documentation](https://reactnative.dev/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
