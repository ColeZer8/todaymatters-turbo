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
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Circle,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Pencil
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Icon } from '@/components/atoms';
import { BottomToolbar } from './BottomToolbar';
import { useGoalsStore, useOnboardingStore } from '@/stores';
import type { Goal, GoalTask } from '@/stores';

/**
 * DemoOverviewGoals - Fully functional Goals analytics and management
 * 
 * Features:
 * - View all goals with progress tracking
 * - Edit mode to add/delete goals and tasks
 * - Auto-imports from onboarding if no goals exist
 * - Persisted to AsyncStorage
 */

// ============================================================================
// Sub-components
// ============================================================================

// Progress ring component
const ProgressRing = ({ 
  progress, 
  size, 
  strokeWidth, 
  color, 
  bgColor 
}: { 
  progress: number; 
  size: number; 
  strokeWidth: number;
  color: string;
  bgColor: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
  
  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <SvgCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </G>
    </Svg>
  );
};

// Mini bar chart for weekly progress
const WeeklyProgressChart = ({ data }: { data: number[] }) => {
  const maxValue = Math.max(...data, 1);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;
  
  return (
    <View className="flex-row items-end justify-between gap-1 h-16">
      {data.map((value, index) => {
        const height = (value / maxValue) * 100;
        const isToday = index === todayIndex;
        return (
          <View key={index} className="flex-1 items-center">
            <View 
              className="w-full rounded-t-sm"
              style={{ 
                height: `${Math.max(height, 8)}%`,
                backgroundColor: isToday ? '#2563EB' : '#DBEAFE',
              }}
            />
            <Text className={`text-[10px] mt-1 ${isToday ? 'font-bold text-[#2563EB]' : 'text-[#9CA3AF]'}`}>
              {days[index]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Task item component
const TaskItem = ({ 
  task, 
  isEditing,
  onToggle,
  onDelete
}: { 
  task: GoalTask;
  isEditing: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) => (
  <Animated.View 
    entering={FadeIn.duration(200)}
    exiting={FadeOut.duration(200)}
    layout={Layout.springify()}
    className="flex-row items-center gap-2 py-1.5"
  >
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      className="flex-row items-center gap-2 flex-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Icon 
        icon={task.done ? CheckCircle2 : Circle} 
        size={18} 
        color={task.done ? '#16A34A' : '#D1D5DB'} 
      />
      <Text 
        className={`text-[14px] flex-1 ${task.done ? 'text-[#9CA3AF] line-through' : 'text-[#374151]'}`}
        numberOfLines={1}
      >
        {task.name}
      </Text>
    </Pressable>
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

// Add task input
const AddTaskInput = ({ 
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
        <Text className="text-[13px] font-medium text-[#2563EB]">Add task</Text>
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
        placeholder="Task name..."
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

// Goal card with full functionality
const GoalCard = ({ 
  goal,
  isEditing,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onDeleteGoal
}: { 
  goal: Goal;
  isEditing: boolean;
  onToggleTask: (taskId: string) => void;
  onAddTask: (name: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDeleteGoal: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const completedTasks = goal.tasks.filter(t => t.done).length;
  const totalTasks = goal.tasks.length;
  
  const handleDeleteGoal = () => {
    Alert.alert(
      'Delete Goal',
      `Are you sure you want to delete "${goal.title}"? This will also delete all associated tasks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDeleteGoal },
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
        {/* Progress Ring */}
        <Pressable 
          className="relative items-center justify-center"
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <ProgressRing 
            progress={goal.progress} 
            size={56} 
            strokeWidth={6}
            color={goal.color}
            bgColor={`${goal.color}30`}
          />
          <View className="absolute">
            <Text className="text-[14px] font-bold" style={{ color: goal.color }}>
              {Math.round(goal.progress * 100)}%
            </Text>
          </View>
        </Pressable>

        {/* Goal Info */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-[16px] font-bold text-[#111827] flex-1" numberOfLines={1}>
              {goal.title}
            </Text>
            <View className="flex-row items-center gap-2">
              {goal.progress > 0 && goal.progress < 1 && (
                <View className="flex-row items-center gap-1 bg-[#DCFCE7] px-2 py-1 rounded-full">
                  <Icon icon={TrendingUp} size={12} color="#16A34A" />
                </View>
              )}
              {goal.progress === 1 && (
                <View className="bg-[#DCFCE7] px-2 py-1 rounded-full">
                  <Text className="text-[11px] font-semibold text-[#16A34A]">Done!</Text>
                </View>
              )}
            </View>
          </View>

          {/* Task count */}
          <Text className="text-[13px] text-[#6B7280]">
            {completedTasks} of {totalTasks} tasks completed
          </Text>
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
          {/* Task list */}
          {goal.tasks.length > 0 && (
            <View className="gap-0 mb-2">
              {goal.tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isEditing={isEditing}
                  onToggle={() => onToggleTask(task.id)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}
            </View>
          )}

          {/* Add task - only show in edit mode */}
          {isEditing && <AddTaskInput onAdd={onAddTask} />}

          {/* Delete goal button - only show in edit mode */}
          {isEditing && (
            <Animated.View entering={FadeIn.duration(150)}>
              <Pressable
                onPress={handleDeleteGoal}
                className="flex-row items-center justify-center gap-2 mt-3 pt-3 border-t border-[#F3F4F6]"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={Trash2} size={14} color="#EF4444" />
                <Text className="text-[13px] font-medium text-[#EF4444]">Delete Goal</Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
};

// Add goal input (shown in edit mode)
const AddGoalSection = ({ onAdd }: { onAdd: (title: string) => void }) => {
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
        <Text className="text-[15px] font-semibold text-[#2563EB]">Add New Goal</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB]"
    >
      <Text className="text-[14px] font-semibold text-[#374151] mb-3">New Goal</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="What do you want to achieve?"
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
          <Text className="text-[14px] font-semibold text-white">Add Goal</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface DemoOverviewGoalsProps {
  /** When true, removes outer padding and BottomToolbar for embedding in other views */
  embedded?: boolean;
}

export const DemoOverviewGoals = ({ embedded = false }: DemoOverviewGoalsProps) => {
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState(false);
  
  // Goals store
  const goals = useGoalsStore((state) => state.goals);
  const hasHydrated = useGoalsStore((state) => state._hasHydrated);
  const addGoal = useGoalsStore((state) => state.addGoal);
  const deleteGoal = useGoalsStore((state) => state.deleteGoal);
  const addTask = useGoalsStore((state) => state.addTask);
  const toggleTask = useGoalsStore((state) => state.toggleTask);
  const deleteTask = useGoalsStore((state) => state.deleteTask);
  const importFromOnboarding = useGoalsStore((state) => state.importFromOnboarding);
  const getOverallProgress = useGoalsStore((state) => state.getOverallProgress);
  const getCompletedTasksCount = useGoalsStore((state) => state.getCompletedTasksCount);
  const getPendingTasksCount = useGoalsStore((state) => state.getPendingTasksCount);
  
  // Onboarding store (for initial import)
  const onboardingGoals = useOnboardingStore((state) => state.goals);
  
  // Import goals from onboarding on first load
  useEffect(() => {
    if (hasHydrated && goals.length === 0 && onboardingGoals.length > 0) {
      importFromOnboarding(onboardingGoals);
    }
  }, [hasHydrated, goals.length, onboardingGoals, importFromOnboarding]);

  // Computed values
  const overallProgress = getOverallProgress();
  const completedTasks = getCompletedTasksCount();
  const pendingTasks = getPendingTasksCount();

  // Generate weekly data (mock for demo, would be real data in production)
  const weeklyData = [
    Math.round(overallProgress * 100 * 0.8),
    Math.round(overallProgress * 100 * 0.9),
    Math.round(overallProgress * 100 * 0.6),
    Math.round(overallProgress * 100 * 1.1),
    Math.round(overallProgress * 100 * 0.7),
    Math.round(overallProgress * 100 * 0.4),
    Math.round(overallProgress * 100),
  ];

  // Handlers
  const handleAddGoal = useCallback((title: string) => {
    addGoal(title);
  }, [addGoal]);

  const handleDeleteGoal = useCallback((goalId: string) => {
    deleteGoal(goalId);
  }, [deleteGoal]);

  const handleAddTask = useCallback((goalId: string, name: string) => {
    addTask(goalId, name);
  }, [addTask]);

  const handleToggleTask = useCallback((goalId: string, taskId: string) => {
    toggleTask(goalId, taskId);
  }, [toggleTask]);

  const handleDeleteTask = useCallback((goalId: string, taskId: string) => {
    deleteTask(goalId, taskId);
  }, [deleteTask]);

  // Content to render (shared between embedded and standalone modes)
  const content = (
    <>
      {/* Header */}
      <View className="mb-4">
        <Text className="text-[38px] leading-[42px] font-extrabold text-[#111827]">
          Goals
        </Text>
        <Text className="text-[38px] leading-[42px] font-extrabold text-[#2563EB]">
          Overview
        </Text>
      </View>

          {/* Summary Message */}
          <View className="mb-5">
            <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568]">
              {goals.length === 0 
                ? "Add your first goal to start tracking your progress."
                : overallProgress >= 0.7 
                  ? "You're making excellent progress on your goals!"
                  : "Keep pushing — every task completed brings you closer."}
            </Text>
          </View>

          {/* Divider */}
          <View className="h-px bg-[#E5E7EB] mb-5" />

          {/* Overall Progress Card */}
          <View className="bg-white rounded-2xl px-4 py-4 border border-[#E5E7EB] mb-5">
            <View className="flex-row items-center gap-2 mb-3">
              <Icon icon={Target} size={18} color="#2563EB" />
              <Text className="text-[15px] font-bold text-[#111827]">
                Overall Progress
              </Text>
            </View>
            
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 items-center">
                <View className="relative items-center justify-center">
                  <ProgressRing 
                    progress={overallProgress} 
                    size={80} 
                    strokeWidth={8}
                    color="#2563EB"
                    bgColor="#DBEAFE"
                  />
                  <View className="absolute">
                    <Text className="text-[20px] font-bold text-[#2563EB]">
                      {Math.round(overallProgress * 100)}%
                    </Text>
                  </View>
                </View>
                <Text className="text-[12px] text-[#6B7280] mt-2">This Week</Text>
              </View>

              <View className="h-16 w-px bg-[#E5E7EB]" />

              <View className="flex-1 items-center gap-2">
                <View className="flex-row items-center gap-1">
                  <Icon icon={CheckCircle2} size={18} color="#16A34A" />
                  <Text className="text-[24px] font-bold text-[#111827]">{completedTasks}</Text>
                </View>
                <Text className="text-[12px] text-[#6B7280]">Tasks Done</Text>
              </View>

              <View className="h-16 w-px bg-[#E5E7EB]" />

              <View className="flex-1 items-center gap-2">
                <View className="flex-row items-center gap-1">
                  <Icon icon={Clock} size={18} color="#F59E0B" />
                  <Text className="text-[24px] font-bold text-[#111827]">{pendingTasks}</Text>
                </View>
                <Text className="text-[12px] text-[#6B7280]">Pending</Text>
              </View>
            </View>

            {/* Weekly Chart */}
            {goals.length > 0 && (
              <>
                <Text className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7280] mb-2">
                  Weekly Activity
                </Text>
                <WeeklyProgressChart data={weeklyData} />
              </>
            )}
          </View>

          {/* AI Insight Card - only show if there are goals */}
          {goals.length > 0 && (
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
                    {pendingTasks > completedTasks 
                      ? "You have more pending tasks than completed. Try breaking larger tasks into smaller ones."
                      : completedTasks > 0 
                        ? "Great momentum! Keep completing tasks to maintain your streak."
                        : "Add tasks to your goals to start tracking progress."}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Section Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#374151]">
              Your Goals ({goals.length})
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

          {/* Goal Cards */}
          {goals.map((goal) => (
            <GoalCard 
              key={goal.id} 
              goal={goal}
              isEditing={isEditing}
              onToggleTask={(taskId) => handleToggleTask(goal.id, taskId)}
              onAddTask={(name) => handleAddTask(goal.id, name)}
              onDeleteTask={(taskId) => handleDeleteTask(goal.id, taskId)}
              onDeleteGoal={() => handleDeleteGoal(goal.id)}
            />
          ))}

      {/* Add Goal Section - only show in edit mode */}
      {isEditing && (
        <Animated.View entering={FadeIn.duration(200)} className="mt-2">
          <AddGoalSection onAdd={handleAddGoal} />
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

