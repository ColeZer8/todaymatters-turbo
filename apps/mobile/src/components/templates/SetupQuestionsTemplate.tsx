import { GradientButton } from '@/components/atoms';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SetupQuestionsTemplateProps {
  step?: number;
  totalSteps?: number;
  options: string[];
  selectedOption?: string | null;
  onSelect: (value: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
}

export const SetupQuestionsTemplate = ({
  step = 2,
  totalSteps = 5,
  options,
  selectedOption,
  onSelect,
  onContinue,
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
            <Text className="text-sm font-semibold text-brand-primary">Step {step} of {totalSteps}</Text>
            <Text className="text-sm font-semibold text-text-secondary">Setup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.titleBlock}>
            <Text className="text-3xl font-extrabold text-text-primary">Who are you?</Text>
            <Text className="mt-3 text-base leading-6 text-text-secondary">
              Help us categorize your primary focus.
            </Text>
          </View>

          <View style={styles.contentWidth}>
            <View style={styles.choiceList}>
              {options.map((option) => {
                const isActive = option === selectedOption;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => onSelect(option)}
                    style={({ pressed }) => [
                      styles.choiceCard,
                      isActive && styles.choiceCardActive,
                      pressed && { opacity: 0.95 },
                    ]}
                  >
                    <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.contentWidth}>
            <GradientButton
              label="Continue"
              onPress={onContinue}
              rightIcon={ArrowRight}
            />
          </View>

          {onSkip ? (
            <Text
              className="text-base font-semibold text-text-primary text-center mt-2"
              onPress={onSkip}
            >
              Skip for now
            </Text>
            ) : null}
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
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E4E8F0',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  titleBlock: {
    marginTop: 6,
    gap: 6,
  },
  choiceList: {
    gap: 14,
    marginTop: 12,
  },
  choiceCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D1DBEC',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '100%',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  choiceCardActive: {
    borderColor: '#2F6FEB',
    backgroundColor: '#EAF2FF',
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  choiceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
  },
  choiceTextActive: {
    color: '#2563EB',
  },
});
