import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Play, SkipForward } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

  return (
    <LinearGradient
      colors={['#f8fafc', '#eff6ff', '#f0f9ff']}
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
              <Text className="text-sm font-semibold text-slate-500">
                <Text className="text-blue-600">Step {step}</Text> of {totalSteps}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-white/80 active:opacity-70"
            >
              <SkipForward size={14} color="#334155" />
              <Text className="text-xs font-semibold text-slate-700">Skip</Text>
            </Pressable>
          </View>

          {/* Progress bar */}
          <View className="mt-4 h-1.5 rounded-full bg-slate-200 overflow-hidden mx-6">
            <View
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${progressPercent}%` }}
            />
          </View>

          {/* Video Placeholder */}
          <View style={styles.videoContainer}>
            <View style={styles.videoPlaceholder}>
              <Pressable
                accessibilityRole="button"
                onPress={onPlay}
                className="items-center justify-center w-20 h-20 rounded-full bg-white/20 active:opacity-80"
                style={styles.playButton}
              >
                <Play size={36} color="#fff" fill="#fff" />
              </Pressable>
              <Text className="text-white text-base font-semibold mt-4 text-center">
                Video Coming Soon
              </Text>
            </View>
          </View>

          {/* Quote Section */}
          <View style={styles.quoteSection}>
            <View style={styles.quoteCard}>
              <Text className="text-2xl font-bold text-slate-900 text-center leading-8">
                "The truth shall set you free"
              </Text>
              <Text className="text-base text-slate-600 text-center mt-4 leading-6">
                This app is designed to help you replace lies with the truth and live a better life.
                We only use your data to help you understand yourself better and make meaningful progress.
              </Text>
            </View>

            <View style={styles.trustPoints}>
              <TrustPoint
                emoji="🔒"
                title="Your data stays yours"
                description="We never sell or share your personal information"
              />
              <TrustPoint
                emoji="🎯"
                title="Personalized insights"
                description="We analyze patterns to help you live intentionally"
              />
              <TrustPoint
                emoji="💡"
                title="Truth-based guidance"
                description="Honest feedback to help you grow"
              />
            </View>
          </View>

          {/* Continue Button */}
          <View style={styles.footer}>
            <GradientButton
              label={hasWatched ? 'Continue' : 'Get Started'}
              onPress={onContinue}
              rightIcon={ArrowRight}
            />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const TrustPoint = ({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) => (
  <View className="flex-row items-start gap-3 py-2">
    <Text className="text-xl">{emoji}</Text>
    <View className="flex-1">
      <Text className="text-sm font-semibold text-slate-800">{title}</Text>
      <Text className="text-xs text-slate-500 mt-0.5">{description}</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  videoContainer: {
    marginTop: 24,
    marginHorizontal: 24,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  quoteSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  trustPoints: {
    marginTop: 20,
    gap: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
});
