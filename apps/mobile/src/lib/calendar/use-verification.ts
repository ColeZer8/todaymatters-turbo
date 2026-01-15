import { useCallback, useState, useEffect, useRef } from 'react';
import { useAuthStore, type ScheduledEvent, type EventCategory } from '@/stores';
import { fetchAllEvidenceForDay, type EvidenceBundle } from '@/lib/supabase/services/evidence-data';
import {
  verifyPlannedEvents,
  generateActualBlocks,
  type VerificationResult,
  type ActualBlock,
  type VerificationStatus,
} from './verification-engine';

// Re-export types for convenience
export type { VerificationResult, VerificationStatus, ActualBlock };

// ============================================================================
// Types
// ============================================================================

export interface UseVerificationOptions {
  /** Auto-fetch evidence when date changes */
  autoFetch?: boolean;
  /** Callback when verification fails */
  onError?: (error: Error) => void;
}

export interface UseVerificationReturn {
  /** Whether evidence is currently being fetched */
  isLoading: boolean;
  /** Last error encountered */
  error: Error | null;
  /** Raw evidence data */
  evidence: EvidenceBundle | null;
  /** Verification results keyed by event ID */
  verificationResults: Map<string, VerificationResult>;
  /** Generated actual calendar blocks */
  actualBlocks: ActualBlock[];
  /** Manually refresh verification data */
  refresh: () => Promise<void>;
  /** Convert actual blocks to ScheduledEvent format */
  actualEventsForDisplay: ScheduledEvent[];
  /** Get verification status for a specific event */
  getVerification: (eventId: string) => VerificationResult | null;
  /** Summary stats for the day */
  daySummary: DaySummary;
}

// Exported for use in templates
export interface DaySummary {
  totalPlanned: number;
  verified: number;
  partial: number;
  unverified: number;
  contradicted: number;
  distracted: number;
  adherenceScore: number; // 0-100
  distractionMinutes: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for verifying planned events against evidence data.
 */
export function useVerification(
  plannedEvents: ScheduledEvent[],
  ymd: string,
  options: UseVerificationOptions = {}
): UseVerificationReturn {
  const { autoFetch = true, onError } = options;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [evidence, setEvidence] = useState<EvidenceBundle | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Map<string, VerificationResult>
  >(new Map());
  const [actualBlocks, setActualBlocks] = useState<ActualBlock[]>([]);

  // Track last fetched to prevent duplicate requests
  const lastFetched = useRef<{ ymd: string; userId: string } | null>(null);

  /**
   * Fetch evidence and run verification.
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setVerificationResults(new Map());
      setActualBlocks([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch evidence from Supabase
      const bundle = await fetchAllEvidenceForDay(userId, ymd);
      setEvidence(bundle);

      // Run verification
      const results = verifyPlannedEvents(plannedEvents, bundle, ymd);
      setVerificationResults(results);

      // Generate actual blocks
      const blocks = generateActualBlocks(bundle, ymd, plannedEvents);
      setActualBlocks(blocks);

      lastFetched.current = { ymd, userId };
    } catch (err) {
      const typedError =
        err instanceof Error ? err : new Error('Failed to fetch evidence');
      setError(typedError);
      onError?.(typedError);

      if (__DEV__) {
        console.error('[Verification] Failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, userId, ymd, plannedEvents, onError]);

  // Auto-fetch when date or user changes
  useEffect(() => {
    if (!autoFetch) return;
    if (!isAuthenticated || !userId) return;

    // Check if we need to refetch
    const needsFetch =
      !lastFetched.current ||
      lastFetched.current.ymd !== ymd ||
      lastFetched.current.userId !== userId;

    if (needsFetch) {
      refresh();
    }
  }, [autoFetch, isAuthenticated, userId, ymd, refresh]);

  // Re-run verification when planned events change (but don't refetch evidence)
  useEffect(() => {
    if (!evidence) return;

    const results = verifyPlannedEvents(plannedEvents, evidence, ymd);
    setVerificationResults(results);

    const blocks = generateActualBlocks(evidence, ymd, plannedEvents);
    setActualBlocks(blocks);
  }, [evidence, plannedEvents, ymd]);

  /**
   * Get verification result for a specific event.
   */
  const getVerification = useCallback(
    (eventId: string): VerificationResult | null => {
      return verificationResults.get(eventId) ?? null;
    },
    [verificationResults]
  );

  /**
   * Convert actual blocks to ScheduledEvent format for display.
   */
  const actualEventsForDisplay: ScheduledEvent[] = actualBlocks.map(
    (block) => ({
      id: block.id,
      title: block.title,
      category: block.category,
      startMinutes: block.startMinutes,
      duration: block.endMinutes - block.startMinutes,
      description: block.description,
    })
  );

  /**
   * Calculate day summary stats.
   */
  const daySummary: DaySummary = (() => {
    let verified = 0;
    let partial = 0;
    let unverified = 0;
    let contradicted = 0;
    let distracted = 0;
    let totalDistractionMinutes = 0;

    for (const result of verificationResults.values()) {
      switch (result.status) {
        case 'verified':
          verified++;
          break;
        case 'partial':
          partial++;
          break;
        case 'unverified':
          unverified++;
          break;
        case 'contradicted':
          contradicted++;
          break;
        case 'distracted':
          distracted++;
          break;
      }

      if (result.evidence.screenTime) {
        totalDistractionMinutes += result.evidence.screenTime.distractionMinutes;
      }
    }

    const total = plannedEvents.length;
    const adherenceScore =
      total > 0
        ? Math.round(((verified + partial * 0.5) / total) * 100)
        : 100;

    return {
      totalPlanned: total,
      verified,
      partial,
      unverified,
      contradicted,
      distracted,
      adherenceScore,
      distractionMinutes: totalDistractionMinutes,
    };
  })();

  return {
    isLoading,
    error,
    evidence,
    verificationResults,
    actualBlocks,
    refresh,
    actualEventsForDisplay,
    getVerification,
    daySummary,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function categoryToColor(category: EventCategory): string {
  const colors: Record<EventCategory, string> = {
    sleep: '#6366f1',
    routine: '#8b5cf6',
    work: '#3b82f6',
    meeting: '#0ea5e9',
    meal: '#f59e0b',
    health: '#22c55e',
    family: '#ec4899',
    social: '#f43f5e',
    travel: '#64748b',
    finance: '#14b8a6',
    comm: '#a855f7',
    digital: '#6b7280',
    unknown: '#9ca3af',
    free: '#d1d5db',
  };
  return colors[category] ?? '#9ca3af';
}
