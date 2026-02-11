/**
 * Location Tracking Health Diagnostics
 * 
 * Checks the state of the location tracking pipeline to identify issues:
 * 1. Is background location tracking running?
 * 2. Are location samples being collected?
 * 3. Is the queue flushing to Supabase?
 * 4. Are activity segments being created?
 * 
 * Usage:
 *   import { runLocationTrackingDiagnostics } from '@/lib/diagnostics/location-tracking-health';
 *   const report = await runLocationTrackingDiagnostics(userId);
 *   console.log(report.summary);
 *   console.log(report.details);
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase/client';
import { IOS_BACKGROUND_LOCATION_TASK_NAME } from '@/lib/ios-location/task-names';

export interface LocationTrackingHealthReport {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'broken';
  /** Human-readable summary */
  summary: string;
  /** Detailed findings */
  details: {
    permissions: PermissionCheck;
    backgroundTask: BackgroundTaskCheck;
    queueState: QueueStateCheck;
    recentSync: RecentSyncCheck;
    recentSegments: RecentSegmentsCheck;
  };
  /** Recommended actions to fix issues */
  recommendations: string[];
}

interface PermissionCheck {
  status: 'ok' | 'warning' | 'error';
  foreground: boolean;
  background: boolean;
  servicesEnabled: boolean;
  message: string;
}

interface BackgroundTaskCheck {
  status: 'ok' | 'warning' | 'error';
  isRegistered: boolean;
  isRunning: boolean | null;
  message: string;
}

interface QueueStateCheck {
  status: 'ok' | 'warning' | 'error';
  pendingCount: number;
  oldestSampleAge: number | null; // milliseconds
  newestSampleAge: number | null; // milliseconds
  message: string;
}

interface RecentSyncCheck {
  status: 'ok' | 'warning' | 'error';
  lastSyncTime: Date | null;
  minutesSinceSync: number | null;
  recentSamplesUploaded: number | null;
  message: string;
}

interface RecentSegmentsCheck {
  status: 'ok' | 'warning' | 'error';
  segmentCount: number;
  lastSegmentTime: Date | null;
  message: string;
}

/**
 * Check location permissions
 */
async function checkPermissions(): Promise<PermissionCheck> {
  try {
    const foregroundStatus = await Location.getForegroundPermissionsAsync();
    const backgroundStatus = await Location.getBackgroundPermissionsAsync();
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    const hasForeground = foregroundStatus.status === 'granted';
    const hasBackground = backgroundStatus.status === 'granted';

    if (!servicesEnabled) {
      return {
        status: 'error',
        foreground: hasForeground,
        background: hasBackground,
        servicesEnabled: false,
        message: '❌ Location services are disabled on this device'
      };
    }

    if (!hasBackground) {
      return {
        status: 'error',
        foreground: hasForeground,
        background: false,
        servicesEnabled: true,
        message: '❌ Background location permission not granted. Need "Always Allow"'
      };
    }

    if (!hasForeground) {
      return {
        status: 'error',
        foreground: false,
        background: hasBackground,
        servicesEnabled: true,
        message: '❌ Foreground location permission not granted'
      };
    }

    return {
      status: 'ok',
      foreground: true,
      background: true,
      servicesEnabled: true,
      message: '✅ Permissions: OK'
    };
  } catch (error) {
    return {
      status: 'error',
      foreground: false,
      background: false,
      servicesEnabled: false,
      message: `❌ Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if background location task is registered and running
 */
async function checkBackgroundTask(): Promise<BackgroundTaskCheck> {
  if (Platform.OS !== 'ios') {
    return {
      status: 'warning',
      isRegistered: false,
      isRunning: null,
      message: '⚠️  Background task check only supported on iOS'
    };
  }

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(IOS_BACKGROUND_LOCATION_TASK_NAME);
    
    if (!isRegistered) {
      return {
        status: 'error',
        isRegistered: false,
        isRunning: null,
        message: '❌ Background location task is NOT registered'
      };
    }

    // Check if task is running (this is an approximation - TaskManager doesn't expose running state directly)
    const foregroundStatus = await Location.getForegroundPermissionsAsync();
    const backgroundStatus = await Location.getBackgroundPermissionsAsync();
    const hasPermissions = foregroundStatus.status === 'granted' && backgroundStatus.status === 'granted';

    return {
      status: 'ok',
      isRegistered: true,
      isRunning: hasPermissions,
      message: hasPermissions 
        ? '✅ Background task: Registered and likely running' 
        : '⚠️  Background task: Registered but permissions may prevent execution'
    };
  } catch (error) {
    return {
      status: 'error',
      isRegistered: false,
      isRunning: null,
      message: `❌ Background task check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check pending location samples queue
 */
async function checkQueueState(userId: string): Promise<QueueStateCheck> {
  try {
    const queueKey = `tm:location:pending:${userId}`;
    const raw = await AsyncStorage.getItem(queueKey);
    
    if (!raw) {
      return {
        status: 'ok',
        pendingCount: 0,
        oldestSampleAge: null,
        newestSampleAge: null,
        message: '✅ Queue: Empty (samples already uploaded)'
      };
    }

    const samples = JSON.parse(raw) as Array<{ recorded_at: string }>;
    const now = Date.now();
    
    if (samples.length === 0) {
      return {
        status: 'ok',
        pendingCount: 0,
        oldestSampleAge: null,
        newestSampleAge: null,
        message: '✅ Queue: Empty'
      };
    }

    const timestamps = samples.map(s => new Date(s.recorded_at).getTime());
    const oldestAge = now - Math.min(...timestamps);
    const newestAge = now - Math.max(...timestamps);

    // Warning if oldest sample is > 1 hour old (sync may be failing)
    if (oldestAge > 60 * 60 * 1000) {
      return {
        status: 'warning',
        pendingCount: samples.length,
        oldestSampleAge: oldestAge,
        newestSampleAge: newestAge,
        message: `⚠️  Queue: ${samples.length} samples pending (oldest: ${Math.round(oldestAge / 1000 / 60)} min old). Sync may be stuck.`
      };
    }

    // Warning if queue is very large (> 1000 samples)
    if (samples.length > 1000) {
      return {
        status: 'warning',
        pendingCount: samples.length,
        oldestSampleAge: oldestAge,
        newestSampleAge: newestAge,
        message: `⚠️  Queue: ${samples.length} samples pending (large backlog)`
      };
    }

    return {
      status: 'ok',
      pendingCount: samples.length,
      oldestSampleAge: oldestAge,
      newestSampleAge: newestAge,
      message: `✅ Queue: ${samples.length} samples pending (recent collection)`
    };
  } catch (error) {
    return {
      status: 'error',
      pendingCount: 0,
      oldestSampleAge: null,
      newestSampleAge: null,
      message: `❌ Queue check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check recent sync activity by looking at location_samples table
 */
async function checkRecentSync(userId: string): Promise<RecentSyncCheck> {
  try {
    // Query last 10 samples to see when data was last uploaded
    const { data, error } = await supabase
      .schema('tm')
      .from('location_samples')
      .select('recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(10);

    if (error) {
      return {
        status: 'error',
        lastSyncTime: null,
        minutesSinceSync: null,
        recentSamplesUploaded: null,
        message: `❌ Sync check failed: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'error',
        lastSyncTime: null,
        minutesSinceSync: null,
        recentSamplesUploaded: 0,
        message: '❌ No location samples found in database (never synced?)'
      };
    }

    const lastSampleTime = new Date(data[0].recorded_at);
    const minutesSinceSync = (Date.now() - lastSampleTime.getTime()) / 1000 / 60;

    // Warning if last sync was > 30 minutes ago (and app is open now)
    if (minutesSinceSync > 30) {
      return {
        status: 'warning',
        lastSyncTime: lastSampleTime,
        minutesSinceSync,
        recentSamplesUploaded: data.length,
        message: `⚠️  Last sample uploaded ${Math.round(minutesSinceSync)} min ago (may be stale)`
      };
    }

    return {
      status: 'ok',
      lastSyncTime: lastSampleTime,
      minutesSinceSync,
      recentSamplesUploaded: data.length,
      message: `✅ Last sample uploaded ${Math.round(minutesSinceSync)} min ago`
    };
  } catch (error) {
    return {
      status: 'error',
      lastSyncTime: null,
      minutesSinceSync: null,
      recentSamplesUploaded: null,
      message: `❌ Sync check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check recent activity segments
 */
async function checkRecentSegments(userId: string): Promise<RecentSegmentsCheck> {
  try {
    // Look for segments from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .schema('tm')
      .from('activity_segments')
      .select('started_at, ended_at')
      .eq('user_id', userId)
      .gte('started_at', oneDayAgo)
      .order('started_at', { ascending: false })
      .limit(10);

    if (error) {
      return {
        status: 'error',
        segmentCount: 0,
        lastSegmentTime: null,
        message: `❌ Segment check failed: ${error.message}`
      };
    }

    if (!data || data.length === 0) {
      return {
        status: 'warning',
        segmentCount: 0,
        lastSegmentTime: null,
        message: '⚠️  No activity segments in last 24 hours'
      };
    }

    const lastSegmentTime = new Date(data[0].started_at);
    const hoursSinceSegment = (Date.now() - lastSegmentTime.getTime()) / 1000 / 60 / 60;

    if (hoursSinceSegment > 2) {
      return {
        status: 'warning',
        segmentCount: data.length,
        lastSegmentTime,
        message: `⚠️  ${data.length} segments in last 24h, but last segment was ${Math.round(hoursSinceSegment)}h ago`
      };
    }

    return {
      status: 'ok',
      segmentCount: data.length,
      lastSegmentTime,
      message: `✅ ${data.length} segments in last 24h (most recent: ${Math.round(hoursSinceSegment)}h ago)`
    };
  } catch (error) {
    return {
      status: 'error',
      segmentCount: 0,
      lastSegmentTime: null,
      message: `❌ Segment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Run full diagnostics and return a health report
 */
export async function runLocationTrackingDiagnostics(userId: string): Promise<LocationTrackingHealthReport> {
  console.log('[LocationHealthDiagnostics] Running diagnostics...');

  const [permissions, backgroundTask, queueState, recentSync, recentSegments] = await Promise.all([
    checkPermissions(),
    checkBackgroundTask(),
    checkQueueState(userId),
    checkRecentSync(userId),
    checkRecentSegments(userId)
  ]);

  const details = {
    permissions,
    backgroundTask,
    queueState,
    recentSync,
    recentSegments
  };

  // Determine overall health
  const errors = Object.values(details).filter(d => d.status === 'error').length;
  const warnings = Object.values(details).filter(d => d.status === 'warning').length;

  let status: 'healthy' | 'degraded' | 'broken';
  let summary: string;

  if (errors > 0) {
    status = 'broken';
    summary = `❌ Location tracking is BROKEN (${errors} errors, ${warnings} warnings)`;
  } else if (warnings > 0) {
    status = 'degraded';
    summary = `⚠️  Location tracking is DEGRADED (${warnings} warnings)`;
  } else {
    status = 'healthy';
    summary = '✅ Location tracking is HEALTHY';
  }

  // Build recommendations
  const recommendations: string[] = [];

  if (permissions.status === 'error') {
    if (!permissions.servicesEnabled) {
      recommendations.push('Enable Location Services in device Settings');
    }
    if (!permissions.background) {
      recommendations.push('Grant "Always Allow" location permission in Settings → TodayMatters → Location');
    }
    if (!permissions.foreground) {
      recommendations.push('Grant "While Using" location permission');
    }
  }

  if (backgroundTask.status === 'error') {
    recommendations.push('Restart the app to re-register background location task');
  }

  if (queueState.status === 'warning' && queueState.pendingCount > 100) {
    recommendations.push('Large queue backlog - check network connection and retry sync');
  }

  if (recentSync.status === 'error') {
    recommendations.push('No samples in database - location tracking may never have run successfully');
  }

  if (recentSync.status === 'warning' && recentSync.minutesSinceSync && recentSync.minutesSinceSync > 30) {
    recommendations.push('Samples not uploading - check network connection and Supabase session');
  }

  if (recentSegments.status === 'warning' || recentSegments.status === 'error') {
    recommendations.push('Activity segments not being generated - check hourly summary pipeline');
  }

  return {
    status,
    summary,
    details,
    recommendations
  };
}

/**
 * Print diagnostic report to console (for debugging)
 */
export function printDiagnosticReport(report: LocationTrackingHealthReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('LOCATION TRACKING HEALTH REPORT');
  console.log('='.repeat(60));
  console.log(report.summary);
  console.log('');
  console.log('Permissions:', report.details.permissions.message);
  console.log('Background Task:', report.details.backgroundTask.message);
  console.log('Queue State:', report.details.queueState.message);
  console.log('Recent Sync:', report.details.recentSync.message);
  console.log('Recent Segments:', report.details.recentSegments.message);
  
  if (report.recommendations.length > 0) {
    console.log('');
    console.log('RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
  
  console.log('='.repeat(60) + '\n');
}
