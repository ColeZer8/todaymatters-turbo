import { supabase } from '../client';
import { handleSupabaseError } from '../utils/error-handler';
import type { Json } from '../database.types';
import type { ScreenTimeSummary, ScreenTimeAppSession } from '@/lib/ios-insights';
import type { UsageSummary } from '@/lib/android-insights';
import { upsertDataSyncState } from './data-sync-state';
import { getReadableAppName } from '@/lib/app-names';

type ScreenTimePlatform = 'ios' | 'android';

interface ScreenTimeDailyInsert {
  user_id: string;
  local_date: string;
  timezone: string;
  platform: ScreenTimePlatform;
  provider: string;
  source_device_id?: string | null;
  total_seconds: number;
  pickups?: number | null;
  notifications?: number | null;
  raw_payload?: Json | null;
  meta?: Json;
}

interface ScreenTimeAppDailyInsert {
  screen_time_daily_id: string;
  user_id: string;
  app_id: string;
  display_name?: string | null;
  duration_seconds: number;
  pickups?: number | null;
  notifications?: number | null;
  meta?: Json;
}

interface ScreenTimeAppHourlyInsert {
  screen_time_daily_id: string;
  user_id: string;
  local_date: string;
  hour: number;
  app_id: string;
  display_name?: string | null;
  duration_seconds: number;
  pickups?: number | null;
  meta?: Json;
}

interface ScreenTimeAppSessionInsert {
  screen_time_daily_id: string;
  user_id: string;
  local_date: string;
  app_id: string;
  display_name?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  pickups?: number | null;
  meta?: Json;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tmSchema(): any {
  return supabase.schema('tm');
}

function toLocalDateIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sumPickupsFromTopApps(topApps: Array<{ pickups?: number }>): number | null {
  const total = topApps.reduce((sum, app) => sum + (app.pickups ?? 0), 0);
  return total > 0 ? total : null;
}

function sumNullableInt(a?: number | null, b?: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function dedupeAppDailyRows(rows: ScreenTimeAppDailyInsert[]): ScreenTimeAppDailyInsert[] {
  const deduped = new Map<string, ScreenTimeAppDailyInsert>();
  for (const row of rows) {
    const existing = deduped.get(row.app_id);
    if (!existing) {
      deduped.set(row.app_id, { ...row });
      continue;
    }
    existing.duration_seconds += row.duration_seconds;
    existing.pickups = sumNullableInt(existing.pickups, row.pickups);
    existing.notifications = sumNullableInt(existing.notifications, row.notifications);
    if (!existing.display_name && row.display_name) {
      existing.display_name = row.display_name;
    }
  }
  return Array.from(deduped.values());
}

async function upsertScreenTimeDaily(row: ScreenTimeDailyInsert): Promise<{ id: string; localDate: string }> {
  const { data, error } = await tmSchema()
    .from('screen_time_daily')
    .upsert(row, { onConflict: 'user_id,local_date,platform,provider' })
    .select('id, local_date')
    .single();

  if (error) throw handleSupabaseError(error);
  return { id: String(data.id), localDate: String(data.local_date) };
}

async function replaceAppDaily(screenTimeDailyId: string, rows: ScreenTimeAppDailyInsert[]): Promise<void> {
  const { error: deleteError } = await tmSchema()
    .from('screen_time_app_daily')
    .delete()
    .eq('screen_time_daily_id', screenTimeDailyId);
  if (deleteError) throw handleSupabaseError(deleteError);
  if (rows.length === 0) return;
  const { error } = await tmSchema().from('screen_time_app_daily').insert(rows);
  if (error) throw handleSupabaseError(error);
}

async function replaceAppHourly(screenTimeDailyId: string, rows: ScreenTimeAppHourlyInsert[]): Promise<void> {
  const { error: deleteError } = await tmSchema()
    .from('screen_time_app_hourly')
    .delete()
    .eq('screen_time_daily_id', screenTimeDailyId);
  if (deleteError) throw handleSupabaseError(deleteError);
  if (rows.length === 0) return;
  const { error } = await tmSchema().from('screen_time_app_hourly').insert(rows);
  if (error) throw handleSupabaseError(error);
}

async function replaceAppSessions(screenTimeDailyId: string, rows: ScreenTimeAppSessionInsert[]): Promise<void> {
  const { error: deleteError } = await tmSchema()
    .from('screen_time_app_sessions')
    .delete()
    .eq('screen_time_daily_id', screenTimeDailyId);
  if (deleteError) throw handleSupabaseError(deleteError);
  if (rows.length === 0) return;
  const { error } = await tmSchema().from('screen_time_app_sessions').insert(rows);
  if (error) throw handleSupabaseError(error);
}

function mapScreenTimeSessions(
  dailyId: string,
  userId: string,
  sessions: ScreenTimeAppSession[],
  timezone: string
): ScreenTimeAppSessionInsert[] {
  return sessions.map((session) => {
    const localDate = toLocalDateIso(session.startedAtIso);
    return {
      screen_time_daily_id: dailyId,
      user_id: userId,
      local_date: localDate,
      app_id: session.bundleIdentifier,
      display_name: getReadableAppName({ appId: session.bundleIdentifier, displayName: session.displayName }),
      started_at: session.startedAtIso,
      ended_at: session.endedAtIso,
      duration_seconds: session.durationSeconds,
      pickups: session.pickups ?? null,
      meta: { timezone } as Json,
    };
  });
}

export async function syncIosScreenTimeSummary(
  userId: string,
  summary: ScreenTimeSummary,
  timezone: string
): Promise<void> {
  const localDate = toLocalDateIso(summary.dayStartIso);
  const provider = 'ios_screentime';

  const dailyRow: ScreenTimeDailyInsert = {
    user_id: userId,
    local_date: localDate,
    timezone,
    platform: 'ios',
    provider,
    total_seconds: summary.totalSeconds,
    pickups: sumPickupsFromTopApps(summary.topApps),
    notifications: null,
    raw_payload: summary as unknown as Json,
    meta: {
      generatedAtIso: summary.generatedAtIso,
      dayStartIso: summary.dayStartIso,
      dayEndIso: summary.dayEndIso,
      hasSessions: Boolean(summary.appSessions?.length),
    } as Json,
  };

  const { id: dailyId } = await upsertScreenTimeDaily(dailyRow);

  const appDailyRows = dedupeAppDailyRows(
    summary.topApps.map((app) => ({
      screen_time_daily_id: dailyId,
      user_id: userId,
      app_id: app.bundleIdentifier,
      display_name: getReadableAppName({ appId: app.bundleIdentifier, displayName: app.displayName }),
      duration_seconds: app.durationSeconds,
      pickups: app.pickups ?? null,
      notifications: null,
      meta: { timezone } as Json,
    }))
  );
  await replaceAppDaily(dailyId, appDailyRows);

  const hourlyByApp = summary.hourlyByApp ?? null;
  if (hourlyByApp && Object.keys(hourlyByApp).length > 0) {
    const appIdToName = new Map(summary.topApps.map((app) => [app.bundleIdentifier, app.displayName]));
    const hourlyRows: ScreenTimeAppHourlyInsert[] = [];
    for (const [appId, hourMap] of Object.entries(hourlyByApp)) {
      for (const [hourKey, seconds] of Object.entries(hourMap)) {
        const hour = Number(hourKey);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
        if (!seconds || seconds <= 0) continue;
        hourlyRows.push({
          screen_time_daily_id: dailyId,
          user_id: userId,
          local_date: localDate,
          hour,
          app_id: appId,
          display_name: getReadableAppName({ appId, displayName: appIdToName.get(appId) ?? null }),
          duration_seconds: seconds,
          pickups: null,
          meta: { timezone } as Json,
        });
      }
    }
    await replaceAppHourly(dailyId, hourlyRows);
  }

  const sessions = summary.appSessions ?? [];
  const sessionRows = sessions.length > 0 ? mapScreenTimeSessions(dailyId, userId, sessions, timezone) : [];
  await replaceAppSessions(dailyId, sessionRows);

  await upsertDataSyncState({
    userId,
    dataset: 'screen_time',
    platform: 'ios',
    provider,
    newestSyncedLocalDate: localDate,
    lastSyncFinishedAt: new Date().toISOString(),
    lastSyncStatus: 'ok',
    lastSyncError: null,
  });
}

export async function syncAndroidUsageSummary(
  userId: string,
  summary: UsageSummary,
  timezone: string
): Promise<void> {
  const localDate = toLocalDateIso(summary.startIso);
  const provider = 'android_digital_wellbeing';

  const dailyRow: ScreenTimeDailyInsert = {
    user_id: userId,
    local_date: localDate,
    timezone,
    platform: 'android',
    provider,
    total_seconds: summary.totalSeconds,
    pickups: null,
    notifications: null,
    raw_payload: summary as unknown as Json,
    meta: {
      generatedAtIso: summary.generatedAtIso,
      startIso: summary.startIso,
      endIso: summary.endIso,
    } as Json,
  };

  const { id: dailyId } = await upsertScreenTimeDaily(dailyRow);

  const appDailyRows = dedupeAppDailyRows(
    summary.topApps.map((app) => ({
      screen_time_daily_id: dailyId,
      user_id: userId,
      app_id: app.packageName,
      display_name: getReadableAppName({ appId: app.packageName, displayName: app.displayName }),
      duration_seconds: app.durationSeconds,
      pickups: null,
      notifications: null,
      meta: { timezone } as Json,
    }))
  );
  await replaceAppDaily(dailyId, appDailyRows);

  // Persist Android sessions to screen_time_app_sessions
  const appIdToName = new Map(summary.topApps.map((app) => [app.packageName, app.displayName]));
  const sessionRows: ScreenTimeAppSessionInsert[] = (summary.sessions ?? [])
    .filter((s) => s.durationSeconds > 0)
    .map((session) => ({
      screen_time_daily_id: dailyId,
      user_id: userId,
      local_date: localDate,
      app_id: session.packageName,
      display_name: getReadableAppName({
        appId: session.packageName,
        displayName: appIdToName.get(session.packageName) ?? null,
      }),
      started_at: session.startIso,
      ended_at: session.endIso,
      duration_seconds: session.durationSeconds,
      pickups: null,
      meta: { timezone } as Json,
    }));
  await replaceAppSessions(dailyId, sessionRows);

  // Persist Android hourlyByApp data to screen_time_app_hourly
  const hourlyByApp = summary.hourlyByApp ?? null;
  if (hourlyByApp && Object.keys(hourlyByApp).length > 0) {
    const hourlyRows: ScreenTimeAppHourlyInsert[] = [];
    for (const [appId, hourMap] of Object.entries(hourlyByApp)) {
      for (const [hourKey, seconds] of Object.entries(hourMap)) {
        const hour = Number(hourKey);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
        if (!seconds || seconds <= 0) continue;
        hourlyRows.push({
          screen_time_daily_id: dailyId,
          user_id: userId,
          local_date: localDate,
          hour,
          app_id: appId,
          display_name: getReadableAppName({ appId, displayName: appIdToName.get(appId) ?? null }),
          duration_seconds: seconds,
          pickups: null,
          meta: { timezone } as Json,
        });
      }
    }
    await replaceAppHourly(dailyId, hourlyRows);
  }

  await upsertDataSyncState({
    userId,
    dataset: 'screen_time',
    platform: 'android',
    provider,
    newestSyncedLocalDate: localDate,
    lastSyncFinishedAt: new Date().toISOString(),
    lastSyncStatus: 'ok',
    lastSyncError: null,
  });
}
