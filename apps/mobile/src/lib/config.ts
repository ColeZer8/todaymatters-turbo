function readEnv(key: string): string | undefined {
  // In Expo/React Native, `process.env` is available at build time.
  // Guard so this doesn’t explode in unusual runtimes.
  try {
    // eslint-disable-next-line no-undef
    return typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>)[key] : undefined;
  } catch {
    return undefined;
  }
}

export function readBooleanEnv(key: string): boolean {
  return readEnv(key) === 'true';
}

/**
 * Forces the app to use mock calendar data (and ignore Supabase-backed planned events)
 * without overwriting anything in the database.
 *
 * Set via `.env`:
 * - EXPO_PUBLIC_USE_MOCK_CALENDAR=true
 */
export const USE_MOCK_CALENDAR = readBooleanEnv('EXPO_PUBLIC_USE_MOCK_CALENDAR');


