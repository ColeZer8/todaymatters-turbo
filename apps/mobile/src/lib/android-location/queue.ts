import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AndroidLocationSample } from './types';

const PENDING_LOCATION_SAMPLES_PREFIX = 'tm:location:pending:';
const MAX_PENDING_SAMPLES_PER_USER = 10_000;

function getPendingKey(userId: string): string {
  return `${PENDING_LOCATION_SAMPLES_PREFIX}${userId}`;
}

function buildDedupeKey(sample: Omit<AndroidLocationSample, 'dedupe_key'>): string {
  const ts = new Date(sample.recorded_at).getTime();
  const lat = sample.latitude.toFixed(5);
  const lng = sample.longitude.toFixed(5);
  const acc = sample.accuracy_m == null ? 'na' : Math.round(sample.accuracy_m).toString();
  return `${ts}:${lat}:${lng}:${acc}:${sample.source}`;
}

function normalizeAndDedupeSamples(samples: Array<Omit<AndroidLocationSample, 'dedupe_key'>>): AndroidLocationSample[] {
  const seen = new Set<string>();
  const out: AndroidLocationSample[] = [];

  for (const s of samples) {
    const dedupe_key = buildDedupeKey(s);
    if (seen.has(dedupe_key)) continue;
    seen.add(dedupe_key);
    out.push({ ...s, dedupe_key });
  }

  out.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  return out;
}

async function readPending(userId: string): Promise<AndroidLocationSample[]> {
  const raw = await AsyncStorage.getItem(getPendingKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AndroidLocationSample[];
  } catch {
    return [];
  }
}

async function writePending(userId: string, samples: AndroidLocationSample[]): Promise<void> {
  if (samples.length === 0) {
    await AsyncStorage.removeItem(getPendingKey(userId));
    return;
  }
  const trimmed =
    samples.length > MAX_PENDING_SAMPLES_PER_USER ? samples.slice(samples.length - MAX_PENDING_SAMPLES_PER_USER) : samples;
  await AsyncStorage.setItem(getPendingKey(userId), JSON.stringify(trimmed));
}

export async function enqueueAndroidLocationSamplesForUserAsync(
  userId: string,
  incoming: Array<Omit<AndroidLocationSample, 'dedupe_key'>>
): Promise<{ enqueued: number; pendingCount: number }> {
  const normalized = normalizeAndDedupeSamples(incoming);
  if (normalized.length === 0) return { enqueued: 0, pendingCount: (await readPending(userId)).length };

  const existing = await readPending(userId);
  const byKey = new Map<string, AndroidLocationSample>();
  for (const s of existing) byKey.set(s.dedupe_key, s);
  for (const s of normalized) byKey.set(s.dedupe_key, s);

  const merged = Array.from(byKey.values()).sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  await writePending(userId, merged);
  return { enqueued: normalized.length, pendingCount: merged.length };
}

export async function peekPendingAndroidLocationSamplesAsync(userId: string, limit: number): Promise<AndroidLocationSample[]> {
  const existing = await readPending(userId);
  if (existing.length <= limit) return existing;
  return existing.slice(0, limit);
}

export async function removePendingAndroidLocationSamplesByKeyAsync(userId: string, dedupeKeys: string[]): Promise<void> {
  if (dedupeKeys.length === 0) return;
  const keySet = new Set(dedupeKeys);
  const existing = await readPending(userId);
  const remaining = existing.filter((s) => !keySet.has(s.dedupe_key));
  await writePending(userId, remaining);
}

export async function clearPendingAndroidLocationSamplesAsync(userId: string): Promise<void> {
  await AsyncStorage.removeItem(getPendingKey(userId));
}


