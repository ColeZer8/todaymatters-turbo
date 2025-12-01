import { GradientButton } from '@/components/atoms';
import { TextChoiceCard } from '@/components/molecules';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface SetupQuestionsTemplateProps {
  step?: number;
  totalSteps?: number;
  options: string[];
  selectedOption?: string | null;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  onSkip?: () => void;
}

export const SetupQuestionsTemplate = ({
  step = ONBOARDING_STEPS.setupQuestions,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  options,
  selectedOption,
  onSelect,
  onContinue,
  onBack,
  onSkip,
}: SetupQuestionsTemplateProps) => {
  const progressPercent = Math.min(100, Math.max(0, (step / totalSteps) * 100));

  return (
    <LinearGradient
      colors={['#f5f9ff', '#eef5ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold text-text-secondary">
                <Text className="text-brand-primary">Step {step}</Text> of {totalSteps}
              </Text>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                  className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-white"
                >
                  <ArrowLeft size={14} color="#111827" />
                  <Text className="text-xs font-semibold text-text-primary">Back</Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="text-sm font-semibold text-text-secondary">Setup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.contentWidth}>
            <View style={styles.titleBlock}>
              <Text className="text-3xl font-extrabold text-text-primary">Who are you?</Text>
              <Text className="text-base leading-6 text-text-secondary">
                Help us categorize your primary focus.
              </Text>
            </View>

            <View style={styles.choiceList}>
              {/* Options list */}
              {options.map((option) => {
                const isActive = option === selectedOption;
                return (
                  <TextChoiceCard
                    key={option}
                    label={option}
                    selected={isActive}
                    onPress={() => onSelect(option)}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.flexSpacer} />

          <View style={styles.contentWidth}>
            <GradientButton
              label="Continue"
              onPress={onContinue}
              rightIcon={ArrowRight}
            />
          </View>

          {/* Skip button removed per request */}
          {/* {onSkip ? (
            <Text
              className="text-base font-semibold text-text-primary text-center mt-2"
              onPress={onSkip}
            >
              Skip for now
            </Text>
            ) : null} */}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  contentWidth: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E4E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  titleBlock: {
    gap: 8,
    marginTop: 12,
  },
  choiceList: {
    gap: 10,
    marginTop: 20,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: 20,
  },
});
