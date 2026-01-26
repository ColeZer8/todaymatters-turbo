import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Target, Check, Clock, Plus } from 'lucide-react-native';
import type { DailyBig3 } from '@/lib/supabase/services';
import type { ScheduledEvent } from '@/stores';

export interface Big3ProgressData {
  big3: DailyBig3 | null;
  /** Today's actual events for computing time allocated per priority */
  actualEvents: ScheduledEvent[];
}

export interface Big3ProgressCardProps {
  data: Big3ProgressData;
  onSetBig3: (p1: string, p2: string, p3: string) => void;
}

export const Big3ProgressCard = ({ data, onSetBig3 }: Big3ProgressCardProps) => {
  const { big3, actualEvents } = data;

  if (!big3) {
    return <SetBig3Cta onSetBig3={onSetBig3} />;
  }

  const priorities = [
    { num: 1 as const, text: big3.priority_1 },
    { num: 2 as const, text: big3.priority_2 },
    { num: 3 as const, text: big3.priority_3 },
  ];

  // Compute minutes allocated per priority from actual events
  const minutesByPriority: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  for (const event of actualEvents) {
    const p = event.meta?.big3_priority;
    if (p === 1 || p === 2 || p === 3) {
      minutesByPriority[p] += event.duration;
    }
  }

  const completedCount = priorities.filter(
    (p) => p.text && minutesByPriority[p.num] > 0
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>YOUR BIG 3</Text>
        <Text style={styles.completionBadge}>
          {completedCount}/3
        </Text>
      </View>

      <View style={styles.card}>
        {priorities.map((priority, index) => {
          const minutes = minutesByPriority[priority.num];
          const hasTime = minutes > 0;
          const hasText = !!priority.text;

          return (
            <View key={priority.num}>
              <View style={styles.priorityRow}>
                <View
                  style={[
                    styles.checkCircle,
                    hasTime ? styles.checkCircleActive : styles.checkCircleInactive,
                  ]}
                >
                  {hasTime ? (
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <Text style={styles.priorityNumber}>{priority.num}</Text>
                  )}
                </View>
                <View style={styles.priorityTextContainer}>
                  <Text
                    style={[
                      styles.priorityText,
                      hasTime && styles.priorityTextCompleted,
                    ]}
                    numberOfLines={1}
                  >
                    {hasText ? priority.text : '(not set)'}
                  </Text>
                  {hasTime ? (
                    <View style={styles.timeRow}>
                      <Clock size={11} color="#6B7280" />
                      <Text style={styles.timeText}>
                        {minutes} min
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {index < priorities.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

function SetBig3Cta({ onSetBig3 }: { onSetBig3: (p1: string, p2: string, p3: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');

  const canSave = p1.trim().length > 0 || p2.trim().length > 0 || p3.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSetBig3(p1.trim(), p2.trim(), p3.trim());
    setExpanded(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>YOUR BIG 3</Text>
      </View>

      {!expanded ? (
        <TouchableOpacity style={styles.ctaCard} onPress={() => setExpanded(true)}>
          <View style={styles.ctaIconContainer}>
            <Target size={20} color="#2563EB" />
          </View>
          <View style={styles.ctaTextContainer}>
            <Text style={styles.ctaTitle}>Set your Big 3 for today</Text>
            <Text style={styles.ctaDescription}>
              Pick 3 things that would make today a success
            </Text>
          </View>
          <Plus size={18} color="#2563EB" />
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          {[
            { num: 1, value: p1, setter: setP1 },
            { num: 2, value: p2, setter: setP2 },
            { num: 3, value: p3, setter: setP3 },
          ].map((field) => (
            <View key={field.num} style={styles.inputRow}>
              <View style={styles.checkCircleInactive}>
                <Text style={styles.priorityNumber}>{field.num}</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder={`Priority ${field.num}`}
                placeholderTextColor="#9CA3AF"
                value={field.value}
                onChangeText={field.setter}
                returnKeyType={field.num === 3 ? 'done' : 'next'}
              />
            </View>
          ))}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setExpanded(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave}
            >
              <Text style={styles.saveButtonText}>Save Big 3</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 11.5,
    letterSpacing: 0.9,
    fontWeight: '800',
    color: '#0F172A',
  },
  completionBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.32)',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkCircleActive: {
    backgroundColor: '#22C55E',
  },
  checkCircleInactive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  priorityNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  priorityTextContainer: {
    flex: 1,
  },
  priorityText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#111827',
  },
  priorityTextCompleted: {
    color: '#22C55E',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.3)',
    marginLeft: 36,
  },
  // CTA styles
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.32)',
  },
  ctaIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.08)',
    marginRight: 12,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  ctaDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  // Inline input styles
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    color: '#111827',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 10,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
