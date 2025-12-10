import { Pressable, ScrollView, Text, View, LayoutChangeEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  ArrowLeft,
  CircleHelp,
  Dumbbell,
  Gift,
  Heart,
  MapPin,
  Scissors,
  Smartphone,
  Sparkles,
  SunMedium,
} from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { TimeSplitControl } from '@/components/molecules';
import { useReviewTimeStore } from '@/stores';

const CATEGORIES = [
  { id: 'faith', label: 'Faith', icon: SunMedium, color: '#F79A3B', bgColor: '#FFF5E8', selectedBg: '#FEF3E2' },
  { id: 'family', label: 'Family', icon: Heart, color: '#5F63F5', bgColor: '#EFF0FF', selectedBg: '#E8E9FF' },
  { id: 'work', label: 'Work', icon: Gift, color: '#2F7BFF', bgColor: '#E9F2FF', selectedBg: '#DBEAFE' },
  { id: 'health', label: 'Health', icon: Dumbbell, color: '#1F9C66', bgColor: '#E8F7EF', selectedBg: '#D1FAE5' },
  { id: 'other', label: 'Other', icon: CircleHelp, color: '#6B7280', bgColor: '#F3F4F6', selectedBg: '#E5E7EB' },
];

const formatDuration = (minutes: number): string => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
  }
  return `${minutes}m`;
};

export const ReviewTimeTemplate = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const blockPositions = useRef<Record<string, number>>({});
  const [splittingBlockId, setSplittingBlockId] = useState<string | null>(null);
  
  const { 
    timeBlocks, 
    assignments, 
    assignCategory, 
    clearAssignment,
    highlightedBlockId,
    setHighlightedBlockId,
    splitTimeBlock,
  } = useReviewTimeStore();

  const totalUnassigned = timeBlocks.reduce((sum, block) => {
    if (!assignments[block.id]) return sum + block.duration;
    return sum;
  }, 0);

  // Scroll to highlighted block on mount
  useEffect(() => {
    if (highlightedBlockId && blockPositions.current[highlightedBlockId] !== undefined) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: blockPositions.current[highlightedBlockId] - 100,
          animated: true,
        });
      }, 100);
    }
    
    // Clear highlight when leaving
    return () => {
      setHighlightedBlockId(null);
    };
  }, [highlightedBlockId, setHighlightedBlockId]);

  const handleBlockLayout = useCallback((blockId: string, event: LayoutChangeEvent) => {
    blockPositions.current[blockId] = event.nativeEvent.layout.y;
  }, []);

  const handleCategorySelect = (blockId: string, categoryId: string) => {
    if (assignments[blockId] === categoryId) {
      clearAssignment(blockId);
    } else {
      assignCategory(blockId, categoryId);
    }
  };

  const handleSplitConfirm = useCallback((blockId: string, splitMinutes: number) => {
    splitTimeBlock(blockId, splitMinutes);
    setSplittingBlockId(null);
  }, [splitTimeBlock]);

  const handleSplitCancel = useCallback(() => {
    setSplittingBlockId(null);
  }, []);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-[#E5E7EB]">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6]"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Icon icon={ArrowLeft} size={20} color="#374151" />
          </Pressable>
          <Text className="text-[18px] font-bold text-text-primary">
            Review Time
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 40 + insets.bottom,
          }}
        >
          {/* Summary */}
          <View className="mb-6 bg-white rounded-2xl p-5 border border-[#E5E7EB]">
            <View className="flex-row items-baseline">
              <Text className="text-[40px] font-bold text-[#1F2937] tracking-tight">
                {formatDuration(totalUnassigned)}
              </Text>
              <Text className="text-[16px] text-[#6B7280] ml-2">
                to assign
              </Text>
            </View>
            <Text className="text-[14px] text-[#9CA3AF] mt-1">
              Tap a category below to assign each time block
            </Text>
          </View>

          {/* Time Blocks */}
          <View className="gap-4">
            {timeBlocks.map((block) => {
              const selectedCategory = assignments[block.id];
              const selectedCat = CATEGORIES.find(c => c.id === selectedCategory);
              const isHighlighted = highlightedBlockId === block.id;
              
              return (
                <View
                  key={block.id}
                  onLayout={(e) => handleBlockLayout(block.id, e)}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{
                    borderWidth: isHighlighted ? 2 : 1,
                    borderColor: isHighlighted 
                      ? '#2563EB' 
                      : selectedCat 
                        ? selectedCat.color + '30' 
                        : '#E5E7EB',
                    shadowColor: isHighlighted ? '#2563EB' : '#0f172a',
                    shadowOpacity: isHighlighted ? 0.15 : 0.05,
                    shadowRadius: isHighlighted ? 16 : 12,
                    shadowOffset: { width: 0, height: isHighlighted ? 6 : 4 },
                  }}
                >
                  {/* Colored top accent when assigned or highlighted */}
                  {(selectedCat || isHighlighted) && (
                    <View 
                      className="h-1" 
                      style={{ backgroundColor: isHighlighted ? '#2563EB' : selectedCat?.color }} 
                    />
                  )}
                  
                  <View className="p-5">
                    {/* Header row */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-[28px] font-bold text-[#1F2937]">
                          {formatDuration(block.duration)}
                        </Text>
                        <Text className="text-[14px] text-[#9CA3AF]">
                          {block.startTime} - {block.endTime}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        {/* Split button - only show for blocks >= 10 minutes */}
                        {block.duration >= 10 && splittingBlockId !== block.id && (
                          <Pressable
                            onPress={() => setSplittingBlockId(block.id)}
                            hitSlop={8}
                            className="flex-row items-center gap-1.5 h-8 px-3 rounded-full bg-[#F3F4F6] border border-[#E5E7EB]"
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                          >
                            <Icon icon={Scissors} size={13} color="#6B7280" />
                            <Text className="text-[12px] font-medium text-[#6B7280]">Split</Text>
                          </Pressable>
                        )}
                        {block.aiSuggestion && (
                          <View 
                            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE' }}
                          >
                            <Icon icon={Sparkles} size={12} color="#6366F1" />
                            <Text className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider">
                              AI Suggestion
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Activity or Location - hidden when splitting */}
                    {splittingBlockId !== block.id && (
                      <View className="mb-5">
                        {block.activityDetected ? (
                          <View className="flex-row items-center gap-2 bg-[#FEF3C7] px-3 py-2 rounded-lg self-start">
                            <Icon icon={Smartphone} size={16} color="#D97706" strokeWidth={1.5} />
                            <Text className="text-[14px] font-medium text-[#92400E]">{block.activityDetected}</Text>
                          </View>
                        ) : block.location ? (
                          <View className="flex-row items-center gap-2 bg-[#DBEAFE] px-3 py-2 rounded-lg self-start">
                            <Icon icon={MapPin} size={16} color="#2563EB" strokeWidth={1.5} />
                            <Text className="text-[14px] font-medium text-[#1E40AF]">Location: {block.location}</Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center gap-2 bg-[#F3F4F6] px-3 py-2 rounded-lg self-start">
                            <Icon icon={CircleHelp} size={16} color="#9CA3AF" strokeWidth={1.5} />
                            <Text className="text-[14px] text-[#9CA3AF]">No activity detected</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Split Control - shown when splitting this block */}
                    {splittingBlockId === block.id ? (
                      <TimeSplitControl
                        duration={block.duration}
                        startTime={block.startTime}
                        endTime={block.endTime}
                        onConfirm={(splitMinutes) => handleSplitConfirm(block.id, splitMinutes)}
                        onCancel={handleSplitCancel}
                      />
                    ) : (
                    /* Category Selection */
                    <View className="flex-row justify-between">
                      {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.id;
                        const isAiSuggested = block.aiSuggestion === cat.id;
                        
                        return (
                          <Pressable
                            key={cat.id}
                            onPress={() => handleCategorySelect(block.id, cat.id)}
                            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                          >
                            <View className="items-center gap-2">
                              <View
                                className="h-[52px] w-[52px] items-center justify-center rounded-full"
                                style={{
                                  backgroundColor: isSelected ? cat.selectedBg : isAiSuggested ? cat.bgColor : '#F9FAFB',
                                  borderWidth: 2,
                                  borderColor: isSelected
                                    ? cat.color
                                    : isAiSuggested
                                    ? cat.color + '60'
                                    : '#E5E7EB',
                                }}
                              >
                                <Icon
                                  icon={cat.icon}
                                  size={22}
                                  color={isSelected ? cat.color : isAiSuggested ? cat.color : '#C4C9D0'}
                                  strokeWidth={isSelected ? 2 : 1.6}
                                />
                              </View>
                              <Text
                                className="text-[11px]"
                                style={{ 
                                  color: isSelected ? cat.color : '#9CA3AF',
                                  fontWeight: isSelected ? '700' : '500',
                                }}
                              >
                              {cat.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};
