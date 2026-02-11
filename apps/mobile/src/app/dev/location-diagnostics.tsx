/**
 * Location Tracking Diagnostics Screen
 * 
 * Dev screen for debugging location tracking pipeline issues.
 * Shows real-time health status and allows running manual checks.
 * 
 * Access: Go to Dev menu → Location Diagnostics
 */

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/stores';
import { 
  runLocationTrackingDiagnostics, 
  printDiagnosticReport,
  type LocationTrackingHealthReport 
} from '@/lib/diagnostics/location-tracking-health';
import { supabase } from '@/lib/supabase/client';

export default function LocationDiagnosticsScreen() {
  const userId = useAuthStore(s => s.user?.id);
  const [report, setReport] = useState<LocationTrackingHealthReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dbResults, setDbResults] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    if (!userId) {
      Alert.alert('Error', 'No user ID found. Please sign in.');
      return;
    }

    setIsRunning(true);
    try {
      const diagnostics = await runLocationTrackingDiagnostics(userId);
      setReport(diagnostics);
      printDiagnosticReport(diagnostics);
    } catch (error) {
      Alert.alert('Error', `Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }, [userId]);

  const checkDateData = useCallback(async (dateYmd: string) => {
    if (!userId) return;

    setIsRunning(true);
    setSelectedDate(dateYmd);
    
    try {
      // Query location samples for the date
      const { data: samples, error: samplesError } = await supabase
        .schema('tm')
        .from('location_samples')
        .select('recorded_at')
        .eq('user_id', userId)
        .gte('recorded_at', `${dateYmd}T00:00:00`)
        .lt('recorded_at', `${dateYmd}T23:59:59`)
        .order('recorded_at', { ascending: true });

      // Query activity segments for the date
      const { data: segments, error: segmentsError } = await supabase
        .schema('tm')
        .from('activity_segments')
        .select('started_at, ended_at, place_label, inferred_activity, evidence')
        .eq('user_id', userId)
        .gte('started_at', `${dateYmd}T00:00:00`)
        .lt('started_at', `${dateYmd}T23:59:59`)
        .order('started_at', { ascending: true });

      let results = `Date: ${dateYmd}\n\n`;
      
      if (samplesError) {
        results += `❌ Samples Error: ${samplesError.message}\n\n`;
      } else {
        results += `Location Samples: ${samples?.length ?? 0}\n`;
        if (samples && samples.length > 0) {
          results += `  First: ${new Date(samples[0].recorded_at).toLocaleString()}\n`;
          results += `  Last: ${new Date(samples[samples.length - 1].recorded_at).toLocaleString()}\n`;
        }
        results += '\n';
      }

      if (segmentsError) {
        results += `❌ Segments Error: ${segmentsError.message}\n\n`;
      } else {
        results += `Activity Segments: ${segments?.length ?? 0}\n`;
        if (segments && segments.length > 0) {
          results += '\nSegments:\n';
          segments.forEach((seg: any) => {
            const start = new Date(seg.started_at).toLocaleTimeString();
            const end = new Date(seg.ended_at).toLocaleTimeString();
            const locationSamples = seg.evidence?.locationSamples ?? 0;
            results += `  ${start} - ${end}: ${seg.place_label ?? 'Unknown'} (${locationSamples} samples)\n`;
            results += `    Activity: ${seg.inferred_activity}\n`;
          });
        }
        results += '\n';
      }

      setDbResults(results);
    } catch (error) {
      Alert.alert('Error', `Date check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }, [userId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'degraded': return '#f59e0b';
      case 'broken': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Location Tracking Diagnostics</Text>
        <Text style={styles.subtitle}>Debug data collection pipeline</Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, isRunning && styles.buttonDisabled]} 
        onPress={runDiagnostics}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running...' : 'Run Health Check'}
        </Text>
      </TouchableOpacity>

      {report && (
        <View style={styles.reportContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getOverallStatusColor(report.status) }]}>
            <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
          </View>
          
          <Text style={styles.summary}>{report.summary}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            
            <View style={styles.checkItem}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(report.details.permissions.status) }]} />
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Permissions</Text>
                <Text style={styles.checkMessage}>{report.details.permissions.message}</Text>
                {!report.details.permissions.background && (
                  <Text style={styles.checkDetail}>
                    ⚠️ Background: {report.details.permissions.background ? '✅' : '❌'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(report.details.backgroundTask.status) }]} />
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Background Task</Text>
                <Text style={styles.checkMessage}>{report.details.backgroundTask.message}</Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(report.details.queueState.status) }]} />
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Queue</Text>
                <Text style={styles.checkMessage}>{report.details.queueState.message}</Text>
                {report.details.queueState.pendingCount > 0 && (
                  <Text style={styles.checkDetail}>
                    Pending: {report.details.queueState.pendingCount} samples
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(report.details.recentSync.status) }]} />
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Recent Sync</Text>
                <Text style={styles.checkMessage}>{report.details.recentSync.message}</Text>
              </View>
            </View>

            <View style={styles.checkItem}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(report.details.recentSegments.status) }]} />
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>Activity Segments</Text>
                <Text style={styles.checkMessage}>{report.details.recentSegments.message}</Text>
              </View>
            </View>
          </View>

          {report.recommendations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {report.recommendations.map((rec, i) => (
                <Text key={i} style={styles.recommendation}>
                  {i + 1}. {rec}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.dateCheckSection}>
        <Text style={styles.sectionTitle}>Check Specific Date</Text>
        <View style={styles.dateButtons}>
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={() => checkDateData('2026-02-11')}
            disabled={isRunning}
          >
            <Text style={styles.dateButtonText}>Feb 11, 2026</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={() => checkDateData(new Date().toISOString().split('T')[0])}
            disabled={isRunning}
          >
            <Text style={styles.dateButtonText}>Today</Text>
          </TouchableOpacity>
        </View>

        {dbResults && (
          <View style={styles.resultsBox}>
            <Text style={styles.resultsText}>{dbResults}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  reportContainer: {
    margin: 20,
    marginTop: 0,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  summary: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  checkItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  checkMessage: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  checkDetail: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  recommendation: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 18,
  },
  dateCheckSection: {
    margin: 20,
    marginTop: 0,
  },
  dateButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  resultsBox: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
  },
  resultsText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: '#f3f4f6',
    lineHeight: 18,
  },
});
