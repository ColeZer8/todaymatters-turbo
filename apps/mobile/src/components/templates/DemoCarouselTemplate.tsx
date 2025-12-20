import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  type ViewToken,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Moon,
  Settings2,
  Sun,
  Sunrise,
  Sunset,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/atoms';
import { useDemoStore, TIME_PRESETS, type TimeOfDay } from '@/stores';

// Import templates for the demo
import { HomeTemplate } from './HomeTemplate';
import { AnalyticsTemplate } from './AnalyticsTemplate';
import { ReviewTimeTemplate } from './ReviewTimeTemplate';
import { ComprehensiveCalendarTemplate } from './ComprehensiveCalendarTemplate';
import { ProfileTemplate } from './ProfileTemplate';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Time preset icons mapping
const TIME_ICONS: Record<TimeOfDay, LucideIcon> = {
  devotional: Clock,
  morning: Sunrise,
  midday: Sun,
  afternoon: Sunset,
  evening: Sunset,
  night: Moon,
};

const TIME_COLORS: Record<TimeOfDay, string> = {
  devotional: '#F59E0B',
  morning: '#F59E0B',
  midday: '#3B82F6',
  afternoon: '#F97316',
  evening: '#8B5CF6',
  night: '#6366F1',
};

interface DemoSlide {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

// Demo slides configuration
const DEMO_SLIDES: DemoSlide[] = [
  {
    id: 'home',
    title: 'Home Dashboard',
    description: 'Daily brief with personalized greeting and schedule overview',
    component: (
      <HomeTemplate
        dailyBrief={{
          name: 'Paul',
          date: 'Friday, Dec 19',
          unassignedCount: 3,
          line1: 'This is your day.',
          line2: 'What matters most right now?',
          line3: 'You have time to move one thing forward.',
        }}
      />
    ),
  },
  {
    id: 'calendar',
    title: 'Planned vs Actual',
    description: 'Side-by-side view comparing your plan to what actually happened',
    component: <ComprehensiveCalendarTemplate />,
  },
  {
    id: 'analytics',
    title: 'Life Analytics',
    description: 'Track time across Faith, Family, Work, and Health categories',
    component: <AnalyticsTemplate />,
  },
  {
    id: 'review-time',
    title: 'Review Time',
    description: 'Categorize unassigned time blocks with AI suggestions',
    component: <ReviewTimeTemplate />,
  },
  {
    id: 'profile',
    title: 'Profile & Goals',
    description: 'Core values, goals, and work initiatives at a glance',
    component: (
      <ProfileTemplate
        name="Paul"
        role="Professional"
        badgeLabel="Pro Member"
        coreValues={['Family', 'Integrity', 'Creativity']}
        goals={[]}
        initiatives={[]}
        menuItems={[]}
      />
    ),
  },
];

export const DemoCarouselTemplate = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<DemoSlide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);

  // Demo store
  const setDemoActive = useDemoStore((state) => state.setActive);
  const setTimeOfDay = useDemoStore((state) => state.setTimeOfDay);
  const timeOfDay = useDemoStore((state) => state.timeOfDay);
  const getFormattedTime = useDemoStore((state) => state.getFormattedTime);

  // Activate demo mode on mount, deactivate on unmount
  useEffect(() => {
    setDemoActive(true);
    return () => setDemoActive(false);
  }, [setDemoActive]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < DEMO_SLIDES.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, []);

  const goToPrevious = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  const goToNext = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => !prev);
  }, []);

  const hideControls = useCallback(() => {
    setShowControls(false);
  }, []);

  const handleTimeSelect = useCallback(
    (time: TimeOfDay) => {
      setTimeOfDay(time);
    },
    [setTimeOfDay]
  );

  const renderSlide: ListRenderItem<DemoSlide> = useCallback(
    ({ item }) => (
      <View
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
        }}
        pointerEvents="box-none"
      >
        <View style={{ flex: 1 }} pointerEvents="none">
          {item.component}
        </View>
      </View>
    ),
    []
  );

  const currentSlide = DEMO_SLIDES[currentIndex];
  const currentIcon = TIME_ICONS[timeOfDay];
  const currentColor = TIME_COLORS[timeOfDay];

  return (
    <View className="flex-1 bg-black">
      {/* Full Screen Carousel */}
      <FlatList
        ref={flatListRef}
        data={DEMO_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        scrollEnabled
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Subtle Corner Button to Open Controls */}
      {!showControls && (
        <Pressable
          onPress={toggleControls}
          hitSlop={12}
          className="absolute h-9 w-9 items-center justify-center rounded-full"
          style={{
            top: insets.top + 8,
            right: 12,
            backgroundColor: 'rgba(0,0,0,0.25)',
          }}
        >
          <Icon icon={Settings2} size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
      )}

      {/* Subtle Slide Indicator (always visible) */}
      <View
        className="absolute left-0 right-0 flex-row justify-center gap-1.5"
        style={{ bottom: insets.bottom + 8 }}
        pointerEvents="none"
      >
        {DEMO_SLIDES.map((slide, index) => (
          <View
            key={slide.id}
            className="rounded-full"
            style={{
              width: index === currentIndex ? 20 : 6,
              height: 6,
              backgroundColor:
                index === currentIndex
                  ? 'rgba(255,255,255,0.9)'
                  : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </View>

      {/* Control Overlay */}
      {showControls && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="absolute inset-0 bg-black/60"
          style={{ zIndex: 20 }}
        >
          <Pressable className="flex-1" onPress={hideControls}>
            {/* Top Bar */}
            <View
              className="flex-row items-center justify-between px-5"
              style={{ paddingTop: insets.top + 8 }}
            >
              {/* Exit Button */}
              <Pressable
                onPress={() => router.back()}
                hitSlop={12}
                className="h-11 w-11 items-center justify-center rounded-full bg-white/20"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Icon icon={X} size={22} color="#FFFFFF" />
              </Pressable>

              {/* Demo Mode Badge */}
              <View className="flex-row items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
                <View className="h-2 w-2 rounded-full bg-red-500" />
                <Text className="text-white font-bold text-[13px]">DEMO</Text>
              </View>

              {/* Current Time Display */}
              <View className="flex-row items-center gap-1.5 bg-white/20 px-3 py-2 rounded-full">
                <Icon icon={currentIcon} size={16} color={currentColor} />
                <Text className="text-white font-semibold text-[13px]">
                  {getFormattedTime()}
                </Text>
              </View>
            </View>

            {/* Center - Slide Info */}
            <View className="flex-1 justify-center items-center px-8">
              <Text className="text-white/60 text-[13px] font-semibold uppercase tracking-wider mb-2">
                {currentIndex + 1} of {DEMO_SLIDES.length}
              </Text>
              <Text className="text-white text-[28px] font-bold text-center mb-2">
                {currentSlide?.title}
              </Text>
              <Text className="text-white/70 text-[16px] text-center max-w-[300px]">
                {currentSlide?.description}
              </Text>

              {/* Navigation Arrows */}
              <View className="flex-row items-center gap-6 mt-8">
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  disabled={currentIndex === 0}
                  className="h-14 w-14 items-center justify-center rounded-full bg-white/20"
                  style={({ pressed }) => ({
                    opacity: currentIndex === 0 ? 0.3 : pressed ? 0.7 : 1,
                  })}
                >
                  <Icon icon={ChevronLeft} size={28} color="#FFFFFF" />
                </Pressable>

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  disabled={currentIndex === DEMO_SLIDES.length - 1}
                  className="h-14 w-14 items-center justify-center rounded-full bg-white/20"
                  style={({ pressed }) => ({
                    opacity:
                      currentIndex === DEMO_SLIDES.length - 1
                        ? 0.3
                        : pressed
                          ? 0.7
                          : 1,
                  })}
                >
                  <Icon icon={ChevronRight} size={28} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* Bottom - Time Controls */}
            <View className="px-5" style={{ paddingBottom: insets.bottom + 20 }}>
              <Text className="text-white/50 text-[11px] font-bold uppercase tracking-wider text-center mb-3">
                Simulate Time of Day
              </Text>
              <View className="flex-row justify-center gap-2">
                {(Object.keys(TIME_PRESETS) as TimeOfDay[]).map((presetId) => {
                  const preset = TIME_PRESETS[presetId];
                  const PresetIcon = TIME_ICONS[presetId];
                  const presetColor = TIME_COLORS[presetId];
                  const isSelected = timeOfDay === presetId;

                  return (
                    <Pressable
                      key={presetId}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTimeSelect(presetId);
                      }}
                      className="items-center px-3 py-2 rounded-xl"
                      style={({ pressed }) => ({
                        backgroundColor: isSelected
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(255,255,255,0.1)',
                        opacity: pressed ? 0.7 : 1,
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: isSelected ? presetColor : 'transparent',
                      })}
                    >
                      <Icon
                        icon={PresetIcon}
                        size={20}
                        color={isSelected ? presetColor : '#FFFFFF'}
                      />
                      <Text
                        className="text-[10px] font-semibold mt-1"
                        style={{
                          color: isSelected ? presetColor : '#FFFFFF',
                        }}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
};






