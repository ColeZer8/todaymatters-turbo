import { GradientButton } from '@/components/atoms';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ArrowRight, CheckSquare, ChevronDown } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface PermissionsTemplateProps {
  allowAllEnabled: boolean;
  onToggleAllowAll: () => void;
  onContinue: () => void;
  onCustomizeLater: () => void;
  onBack?: () => void;
  step?: number;
  totalSteps?: number;
}

export const PermissionsTemplate = ({
  allowAllEnabled,
  onToggleAllowAll,
  onContinue,
  onCustomizeLater,
  onBack,
  step = ONBOARDING_STEPS.permissions,
  totalSteps = ONBOARDING_TOTAL_STEPS,
}: PermissionsTemplateProps) => {
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

          <View style={styles.titleBlock}>
            <Text className="text-3xl font-extrabold text-text-primary">Sync your day in the background</Text>
            <Text className="text-base leading-6 text-text-secondary">
              To build your ideal schedule, we&apos;ll read your existing events and habits while you answer a few
              quick questions.
            </Text>
          </View>

          <View style={styles.permissionsHeader}>
            <Text className="text-xl font-extrabold text-text-primary">Permissions needed</Text>
            <View style={styles.headerUnderline} />
          </View>

            <Pressable
              accessibilityRole="button"
              onPress={onToggleAllowAll}
              style={({ pressed }) => [styles.allowPill, pressed && { opacity: 0.96 }]}
            >
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.allowPillGradient}
              >
                <View style={styles.allowPillContent}>
                  <View style={styles.allowIconWrapper}>
                    <CheckSquare size={22} color="#fff" />
                  </View>
                  <View style={styles.allowTextBlock}>
                    <Text className="text-base font-semibold text-white">Allow all permissions</Text>
                    <Text className="text-sm text-white/90">Calendar, notifications, email, health &amp; more</Text>
                  </View>
                  <View style={styles.toggleShell}>
                    <View style={[styles.toggleKnob, allowAllEnabled && styles.toggleKnobOn]} />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

          <View style={styles.individualRow}>
            <Text className="text-base font-semibold text-brand-primary">View individual permissions</Text>
            <ChevronDown size={18} color="#2563EB" />
          </View>

          <View style={styles.flexSpacer} />

          <GradientButton
            label="Allow & continue"
            onPress={onContinue}
            rightIcon={ArrowRight}
          />

          {/* Removed Customize later option as requested */}
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
    marginTop: 12,
    gap: 8,
  },
  permissionsHeader: {
    marginBottom: 8,
  },
  headerUnderline: {
    display: 'none', // Hidden to cleaner look
    height: 1,
    backgroundColor: '#D7E3FF',
    width: '100%',
  },
  allowPill: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  allowPillGradient: {
    borderRadius: 16,
  },
  allowPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  allowIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 16,
  },
  allowTextBlock: {
    flex: 1,
  },
  toggleShell: {
    width: 52,
    height: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleKnobOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  individualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: 24,
  },
});
