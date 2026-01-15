import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Info, LockKeyhole, Play, SkipForward, Target } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/atoms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface ExplainerVideoTemplateProps {
  step?: number;
  totalSteps?: number;
  hasWatched: boolean;
  onPlay?: () => void;
  onSkip: () => void;
  onContinue: () => void;
}

export const ExplainerVideoTemplate = ({
  step = ONBOARDING_STEPS.explainerVideo,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  hasWatched,
  onPlay,
  onSkip,
  onContinue,
}: ExplainerVideoTemplateProps) => {
  const progressPercent = Math.min(100, Math.max(0, (step / totalSteps) * 100));
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#f5f9ff', '#eef5ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-text-secondary">
                <Text className="text-brand-primary">Step {step}</Text> of {totalSteps}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="flex-row items-center gap-1 rounded-full bg-white px-3 py-1.5 active:opacity-70"
            >
              <SkipForward size={14} color="#111827" />
              <Text className="text-xs font-semibold text-text-primary">Skip</Text>
            </Pressable>
          </View>

          {/* Scrollable content (so smaller screens don't get covered by the pinned CTA) */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: BOTTOM_CTA_HEIGHT + 24 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentWidth}>
              {/* Progress bar */}
              <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E4E8F0]">
                <View
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${progressPercent}%` }}
                />
              </View>

              {/* Video Placeholder */}
              <View style={styles.videoContainer}>
                <LinearGradient
                  colors={['#1E3A8A', '#1E293B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.videoPlaceholder}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={onPlay}
                    className="h-20 w-20 items-center justify-center rounded-full bg-white/20 active:opacity-80"
                    style={styles.playButton}
                  >
                    <Play size={36} color="#fff" fill="#fff" />
                  </Pressable>
                  <Text className="mt-4 text-center text-base font-semibold text-white">
                    Video Coming Soon
                  </Text>
                </LinearGradient>
              </View>

              {/* Explainer copy */}
              <View
                className="mt-5 rounded-2xl border border-[#E4E8F0] bg-white px-5 py-4"
                style={styles.copyCard}
              >
                <View className="flex-row items-center gap-2">
                  <Info size={18} color="#2563EB" />
                  <Text className="text-[17px] font-extrabold text-text-primary">
                    Before you start
                  </Text>
                </View>

                <Text className="mt-3 text-sm leading-5 text-text-secondary">
                  Today Matters exists to help you replace lies with truth so you can live a better
                  life.
                </Text>
                <Text className="mt-2 text-sm leading-5 text-text-secondary">
                  We only use your data to help you understand your patterns and make meaningful
                  progress.
                </Text>

                <View className="mt-4 gap-3">
                  <InfoRow
                    icon={LockKeyhole}
                    title="Privacy matters"
                    description="We do not sell your personal information."
                  />
                  <InfoRow
                    icon={Target}
                    title="Clear purpose"
                    description="Your data is used only to generate insights and help you live intentionally."
                  />
                </View>

                <Text className="mt-5 text-center text-base font-extrabold text-text-primary">
                  "The truth shall set you free."
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Pinned CTA */}
          <View
            style={[
              styles.bottomCta,
              { paddingBottom: 14 + insets.bottom },
            ]}
          >
            <View style={styles.contentWidth}>
              <GradientButton
                label={hasWatched ? 'Continue' : 'Get Started'}
                onPress={onContinue}
                rightIcon={ArrowRight}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const InfoRow = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
}) => (
  <View className="flex-row items-start gap-3">
    <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-xl bg-[#EEF2FF]">
      <Icon size={16} color="#2563EB" />
    </View>
    <View className="flex-1">
      <Text className="text-sm font-semibold text-text-primary">{title}</Text>
      <Text className="mt-0.5 text-xs leading-4 text-text-secondary">{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 20,
  },
  contentWidth: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    paddingHorizontal: 26,
  },
  videoContainer: {
    marginTop: 16,
    alignSelf: 'center',
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E4E8F0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  copyCard: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  bottomCta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: 'rgba(245, 249, 255, 0.92)',
  },
});

const BOTTOM_CTA_HEIGHT = 74;
