function looksLikeBundleOrPackageId(value: string): boolean {
  // e.g. com.google.android.apps.maps, com.apple.Maps, org.mozilla.firefox
  return /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)+$/.test(value);
}

const GENERIC_ID_SEGMENTS = new Set([
  'android',
  'ios',
  'iphone',
  'ipad',
  'mobile',
  'app',
  'apps',
  'prod',
  'production',
  'debug',
  'release',
  'free',
  'paid',
  'beta',
  'alpha',
]);

/**
 * Prefer OS-provided `displayName`, but when we only have a bundle/package identifier
 * (e.g. `com.google.android.apps.maps`) return a short human-ish label (`maps`).
 */
export function getReadableAppName(options: {
  appId?: string | null;
  displayName?: string | null;
}): string | null {
  const rawDisplayName = options.displayName?.trim() ?? '';
  if (rawDisplayName && !looksLikeBundleOrPackageId(rawDisplayName)) {
    return rawDisplayName;
  }

  const rawId = (options.appId ?? rawDisplayName).trim();
  if (!rawId) return null;
  if (!looksLikeBundleOrPackageId(rawId)) return rawId;

  const parts = rawId.split('.').filter(Boolean);
  if (parts.length === 0) return rawId;

  // Pick the last non-generic segment (e.g. com.snapchat.android -> snapchat).
  let candidate: string | null = null;
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i] ?? '';
    const normalized = segment.trim().toLowerCase();
    if (!normalized) continue;
    if (GENERIC_ID_SEGMENTS.has(normalized)) continue;
    if (normalized === 'com' || normalized === 'org' || normalized === 'net' || normalized === 'io') continue;
    candidate = segment;
    break;
  }

  const resolved = (candidate ?? parts[parts.length - 1] ?? rawId).trim();
  if (!resolved) return rawId;

  return resolved.replace(/[_-]+/g, ' ');
}

