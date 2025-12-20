import { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  TextInput, 
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Briefcase, 
  TrendingUp,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Calendar,
  X,
  Sparkles,
  Flag,
  Pencil
} from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';
import { useInitiativesStore, useOnboardingStore } from '@/stores';
import type { Initiative, Milestone } from '@/stores';

/**
 * DemoOverviewInitiatives - Fully functional Work Initiatives management
 * 
 * Features:
 * - View all initiatives with progress tracking
 * - Edit mode to add/delete initiatives and milestones
 * - Auto-imports from onboarding if no initiatives exist
 * - Persisted to AsyncStorage
 */

// ============================================================================
// Sub-components
// ============================================================================

// Progress bar component
const ProgressBar = ({ 
  progress, 
  color, 
  height = 8 
}: { 
  progress: number; 
  color: string; 
  height?: number;
}) => {
  const bgColor = `${color}30`;
  return (
    <View 
      className="rounded-full overflow-hidden w-full" 
      style={{ height, backgroundColor: bgColor }}
    >
      <View 
        className="h-full rounded-full" 
        style={{ width: `${Math.min(progress * 100, 100)}%`, backgroundColor: color }} 
      />
    </View>
  );
};

// Milestone item component
const MilestoneItem = ({ 
  milestone, 
  isEditing,
  onToggle,
  onDelete
}: { 
  milestone: Milestone;
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
      className="flex-row items-center gap-2 py-2"
    >
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        className="flex-row items-center gap-2 flex-1"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Icon 
          icon={milestone.completed ? CheckCircle2 : Circle} 
          size={18} 
          color={milestone.completed ? '#16A34A' : '#D1D5DB'} 
        />
        <Text 
          className={`text-[14px] flex-1 ${milestone.completed ? 'text-[#9CA3AF] line-through' : 'text-[#374151]'}`}
          numberOfLines={1}
        >
          {milestone.name}
        </Text>
      </Pressable>
      {milestone.dueDate && (
        <View className="flex-row items-center gap-1 bg-[#F3F4F6] px-2 py-1 rounded-md">
          <Icon icon={Calendar} size={12} color="#6B7280" />
          <Text className="text-[11px] text-[#6B7280]">{formatDate(milestone.dueDate)}</Text>
        </View>
      )}
      {isEditing && (
        <Animated.View entering={FadeIn.duration(150)}>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            className="p-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Icon icon={X} size={14} color="#EF4444" />
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
};

// Add milestone input
const AddMilestoneInput = ({ 
  onAdd 
}: { 
  onAdd: (name: string) => void;
}) => {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <Pressable
        onPress={() => setIsAdding(true)}
        className="flex-row items-center gap-2 py-2"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Icon icon={Plus} size={16} color="#2563EB" />
        <Text className="text-[13px] font-medium text-[#2563EB]">Add milestone</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      className="flex-row items-center gap-2 py-1"
    >
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Milestone name..."
        placeholderTextColor="#9CA3AF"
        autoFocus
        onSubmitEditing={handleSubmit}
        onBlur={() => {
          if (!value.trim()) setIsAdding(false);
        }}
        className="flex-1 text-[14px] text-[#374151] bg-[#F9FAFB] rounded-lg px-3 py-2 border border-[#E5E7EB]"
      />
      <Pressable
        onPress={handleSubmit}
        className="bg-[#2563EB] px-3 py-2 rounded-lg"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Text className="text-[13px] font-semibold text-white">Add</Text>
      </Pressable>
    </Animated.View>
  );
};

// Initiative card with full functionality
const InitiativeCard = ({ 
  initiative,
  isEditing,
  onToggleMilestone,
  onAddMilestone,
  onDeleteMilestone,
  onDeleteInitiative
}: { 
  initiative: Initiative;
  isEditing: boolean;
  onToggleMilestone: (milestoneId: string) => void;
  onAddMilestone: (name: string) => void;
  onDeleteMilestone: (milestoneId: string) => void;
  onDeleteInitiative: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const completedMilestones = initiative.milestones.filter(m => m.completed).length;
  const totalMilestones = initiative.milestones.length;
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const handleDeleteInitiative = () => {
    Alert.alert(
      'Delete Initiative',
      `Are you sure you want to delete "${initiative.title}"? This will also delete all milestones.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteInitiative },
      ]
    );
  };
  
  return (
    <Animated.View 
      entering={FadeIn.duration(300)}
      layout={Layout.springify()}
      className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] mb-3"
    >
      {/* Header */}
      <View className="flex-row items-start gap-3">
        {/* Icon */}
        <View 
          className="h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${initiative.color}15` }}
        >
          <Icon icon={Briefcase} size={22} color={initiative.color} />
        </View>

        {/* Initiative Info */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-[16px] font-bold text-[#111827] flex-1" numberOfLines={1}>
              {initiative.title}
            </Text>
            {initiative.progress > 0 && initiative.progress < 1 && (
              <View className="flex-row items-center gap-1 bg-[#DCFCE7] px-2 py-1 rounded-full">
                <Icon icon={TrendingUp} size={12} color="#16A34A" />
              </View>
            )}
            {initiative.progress === 1 && (
              <View className="bg-[#DCFCE7] px-2 py-1 rounded-full">
                <Text className="text-[11px] font-semibold text-[#16A34A]">Complete!</Text>
              </View>
            )}
          </View>

          {/* Progress bar */}
          <View className="flex-row items-center gap-2 mt-2">
            <View className="flex-1">
              <ProgressBar progress={initiative.progress} color={initiative.color} />
            </View>
            <Text className="text-[13px] font-semibold" style={{ color: initiative.color }}>
              {Math.round(initiative.progress * 100)}%
            </Text>
          </View>

          {/* Meta info */}
          <View className="flex-row items-center gap-4 mt-2">
            <View className="flex-row items-center gap-1">
              <Icon icon={Calendar} size={12} color="#6B7280" />
              <Text className="text-[11px] text-[#6B7280]">{formatDate(initiative.dueDate)}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Icon icon={Flag} size={12} color="#6B7280" />
              <Text className="text-[11px] text-[#6B7280]">
                {completedMilestones}/{totalMilestones} milestones
              </Text>
            </View>
          </View>
        </View>

        {/* Expand/Collapse */}
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          hitSlop={8}
          className="p-1"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Icon 
            icon={isExpanded ? ChevronUp : ChevronDown} 
            size={20} 
            color="#9CA3AF" 
          />
        </Pressable>
      </View>

      {/* Expanded Content */}
      {isExpanded && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          className="mt-4 pt-3 border-t border-[#F3F4F6]"
        >
          {/* Milestones header */}
          <Text className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280] mb-2">
            Milestones
          </Text>

          {/* Milestone list */}
          {initiative.milestones.length > 0 && (
            <View className="gap-0 mb-2">
              {initiative.milestones.map((milestone) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  isEditing={isEditing}
                  onToggle={() => onToggleMilestone(milestone.id)}
                  onDelete={() => onDeleteMilestone(milestone.id)}
                />
              ))}
            </View>
          )}

          {/* Add milestone - only show in edit mode */}
          {isEditing && <AddMilestoneInput onAdd={onAddMilestone} />}

          {/* Delete initiative button - only show in edit mode */}
          {isEditing && (
            <Animated.View entering={FadeIn.duration(150)}>
              <Pressable
                onPress={handleDeleteInitiative}
                className="flex-row items-center justify-center gap-2 mt-3 pt-3 border-t border-[#F3F4F6]"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={Trash2} size={14} color="#EF4444" />
                <Text className="text-[13px] font-medium text-[#EF4444]">Delete Initiative</Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
};

// Add initiative section (shown in edit mode)
const AddInitiativeSection = ({ onAdd }: { onAdd: (title: string) => void }) => {
  const [value, setValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <Pressable
        onPress={() => setIsAdding(true)}
        className="flex-row items-center justify-center gap-2 bg-[#EFF6FF] rounded-2xl px-4 py-4 border-2 border-dashed border-[#BFDBFE]"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Icon icon={Plus} size={20} color="#2563EB" />
        <Text className="text-[15px] font-semibold text-[#2563EB]">Add New Initiative</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]"
    >
      <Text className="text-[14px] font-semibold text-[#374151] mb-3">New Initiative</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Initiative name (e.g., Q1 Product Launch)"
        placeholderTextColor="#9CA3AF"
        autoFocus
        onSubmitEditing={handleSubmit}
        className="text-[16px] text-[#111827] bg-[#F9FAFB] rounded-xl px-4 py-3 border border-[#E5E7EB] mb-3"
      />
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => {
            setValue('');
            setIsAdding(false);
          }}
          className="flex-1 items-center py-3 rounded-xl bg-[#F3F4F6]"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-[14px] font-semibold text-[#6B7280]">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          className="flex-1 items-center py-3 rounded-xl bg-[#2563EB]"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-[14px] font-semibold text-white">Add Initiative</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface DemoOverviewInitiativesProps {
  /** When true, removes outer padding and BottomToolbar for embedding in other views */
  embedded?: boolean;
}

export const DemoOverviewInitiatives = ({ embedded = false }: DemoOverviewInitiativesProps) => {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  
  // Initiatives store
  const initiatives = useInitiativesStore((state) => state.initiatives);
  const hasHydrated = useInitiativesStore((state) => state._hasHydrated);
  const addInitiative = useInitiativesStore((state) => state.addInitiative);
  const deleteInitiative = useInitiativesStore((state) => state.deleteInitiative);
  const addMilestone = useInitiativesStore((state) => state.addMilestone);
  const toggleMilestone = useInitiativesStore((state) => state.toggleMilestone);
  const deleteMilestone = useInitiativesStore((state) => state.deleteMilestone);
  const importFromOnboarding = useInitiativesStore((state) => state.importFromOnboarding);
  const getOverallProgress = useInitiativesStore((state) => state.getOverallProgress);
  const getCompletedMilestonesCount = useInitiativesStore((state) => state.getCompletedMilestonesCount);
  const getPendingMilestonesCount = useInitiativesStore((state) => state.getPendingMilestonesCount);
  
  // Onboarding store (for initial import)
  const onboardingInitiatives = useOnboardingStore((state) => state.initiatives);
  
  // Import initiatives from onboarding on first load
  useEffect(() => {
    if (hasHydrated && initiatives.length === 0 && onboardingInitiatives.length > 0) {
      importFromOnboarding(onboardingInitiatives);
    }
  }, [hasHydrated, initiatives.length, onboardingInitiatives, importFromOnboarding]);

  // Computed values
  const overallProgress = getOverallProgress();
  const completedMilestones = getCompletedMilestonesCount();
  const pendingMilestones = getPendingMilestonesCount();

  // Handlers
  const handleAddInitiative = useCallback((title: string) => {
    addInitiative(title);
  }, [addInitiative]);

  const handleDeleteInitiative = useCallback((initiativeId: string) => {
    deleteInitiative(initiativeId);
  }, [deleteInitiative]);

  const handleAddMilestone = useCallback((initiativeId: string, name: string) => {
    addMilestone(initiativeId, name);
  }, [addMilestone]);

  const handleToggleMilestone = useCallback((initiativeId: string, milestoneId: string) => {
    toggleMilestone(initiativeId, milestoneId);
  }, [toggleMilestone]);

  const handleDeleteMilestone = useCallback((initiativeId: string, milestoneId: string) => {
    deleteMilestone(initiativeId, milestoneId);
  }, [deleteMilestone]);

  // Content to render (shared between embedded and standalone modes)
  const content = (
    <>
      {/* Header */}
      <View className="mb-4">
        <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
          Initiatives
        </Text>
        <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
          Overview
        </Text>
      </View>

          {/* Summary Message */}
          <View className="mb-5">
            <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
              {initiatives.length === 0 
                ? "Add your first initiative to start tracking projects."
                : overallProgress >= 0.7 
                  ? "Your initiatives are progressing excellently!"
                  : "Track milestones to see your initiatives progress."}
            </Text>
          </View>

          {/* Divider */}
          <View className="h-px bg-[#E5E7EB] mb-5" />

          {/* Summary Stats Card */}
          <View className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] mb-5">
            <View className="flex-row items-center gap-2 mb-4">
              <Icon icon={Briefcase} size={18} color="#2563EB" />
              <Text className="text-[15px] font-bold text-[#111827]">
                Overall Progress
              </Text>
            </View>

            {/* Stats Grid */}
            <View className="flex-row mb-4">
              <View className="flex-1 items-center border-r border-[#E5E7EB]">
                <Text className="text-[28px] font-bold text-[#2563EB]">
                  {Math.round(overallProgress * 100)}%
                </Text>
                <Text className="text-[12px] text-[#6B7280]">Avg Progress</Text>
              </View>
              <View className="flex-1 items-center border-r border-[#E5E7EB]">
                <Text className="text-[28px] font-bold text-[#111827]">
                  {initiatives.length}
                </Text>
                <Text className="text-[12px] text-[#6B7280]">Active</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[28px] font-bold text-[#2563EB]">
                  {completedMilestones}
                </Text>
                <Text className="text-[12px] text-[#6B7280]">Milestones</Text>
              </View>
            </View>

            {/* Progress summary */}
            {initiatives.length > 0 && (
              <View className="pt-3 border-t border-[#F3F4F6]">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[13px] text-[#6B7280]">Combined Progress</Text>
                  <Text className="text-[13px] font-semibold text-[#2563EB]">
                    {completedMilestones} / {completedMilestones + pendingMilestones} milestones
                  </Text>
                </View>
                <ProgressBar progress={overallProgress} color="#2563EB" height={6} />
              </View>
            )}
          </View>

          {/* AI Insight Card - only show if there are initiatives */}
          {initiatives.length > 0 && (
            <View className="bg-[#EFF6FF] rounded-2xl px-4 py-4 border border-[#DBEAFE] mb-5">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]">
                  <Icon icon={Sparkles} size={20} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-[#1E40AF] mb-1">
                    AI Insight
                  </Text>
                  <Text className="text-[14px] leading-[20px] text-[#3B82F6]">
                    {pendingMilestones > completedMilestones 
                      ? "Consider prioritizing your nearest deadline milestones to maintain momentum."
                      : completedMilestones > 0 
                        ? "Excellent progress! Your milestone completion rate is strong."
                        : "Add milestones to break down your initiatives into trackable steps."}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Upcoming Deadlines - if any */}
          {initiatives.length > 0 && (
            <View className="bg-[#FFFBEB] rounded-2xl px-4 py-4 border border-[#FDE68A] mb-5">
              <View className="flex-row items-center gap-2 mb-3">
                <Icon icon={Clock} size={16} color="#F59E0B" />
                <Text className="text-[14px] font-bold text-[#92400E]">
                  Active Initiatives
                </Text>
              </View>
              <View className="gap-2">
                {initiatives.slice(0, 3).map((initiative) => (
                  <View key={initiative.id} className="flex-row items-center justify-between">
                    <Text className="text-[13px] text-[#B45309] flex-1" numberOfLines={1}>
                      {initiative.title}
                    </Text>
                    <Text className="text-[13px] font-semibold text-[#92400E]">
                      {Math.round(initiative.progress * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Section Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151]">
              Active Initiatives ({initiatives.length})
            </Text>
            <Pressable
              onPress={() => setIsEditing(!isEditing)}
              className={`flex-row items-center gap-2 px-4 py-2.5 rounded-xl ${isEditing ? 'bg-[#2563EB]' : 'bg-white border border-[#E5E7EB]'}`}
              style={({ pressed }) => ({ 
                opacity: pressed ? 0.8 : 1,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              })}
            >
              <Icon icon={Pencil} size={16} color={isEditing ? '#FFFFFF' : '#2563EB'} />
              <Text className={`text-[14px] font-semibold ${isEditing ? 'text-white' : 'text-[#2563EB]'}`}>
                {isEditing ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
          </View>

          {/* Initiative Cards */}
          {initiatives.map((initiative) => (
            <InitiativeCard 
              key={initiative.id} 
              initiative={initiative}
              isEditing={isEditing}
              onToggleMilestone={(milestoneId) => handleToggleMilestone(initiative.id, milestoneId)}
              onAddMilestone={(name) => handleAddMilestone(initiative.id, name)}
              onDeleteMilestone={(milestoneId) => handleDeleteMilestone(initiative.id, milestoneId)}
              onDeleteInitiative={() => handleDeleteInitiative(initiative.id)}
            />
          ))}

      {/* Add Initiative Section - only show in edit mode */}
      {isEditing && (
        <Animated.View entering={FadeIn.duration(200)} className="mt-2">
          <AddInitiativeSection onAdd={handleAddInitiative} />
        </Animated.View>
      )}
    </>
  );

  // Embedded mode - just return content without wrappers
  if (embedded) {
    return <View>{content}</View>;
  }

  // Standalone mode - full layout with KeyboardAvoidingView, ScrollView, etc.
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F7FAFF]"
    >
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
      >
        <ScrollView 
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>

        <BottomToolbar />
      </View>
    </KeyboardAvoidingView>
  );
};






