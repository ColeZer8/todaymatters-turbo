import { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SetupStepLayoutProps {
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  /** When 'settings', hides progress bar and step indicators, shows settings-style header */
  mode?: 'onboarding' | 'settings';
}

export const SetupStepLayout = ({
  step = 1,
  totalSteps = 1,
  title,
  subtitle,
  children,
  footer,
  onBack,
  mode = 'onboarding',
}: SetupStepLayoutProps) => {
  const progressPercent = Math.min(100, Math.max(0, (step / totalSteps) * 100));
  const isSettings = mode === 'settings';

  return (
    <LinearGradient
      colors={['#f5f9ff', '#eef5ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            {/* Settings mode header */}
            {isSettings ? (
              <View style={styles.settingsHeader}>
                {onBack ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onBack}
                    hitSlop={12}
                    style={({ pressed }) => [
                      styles.settingsBackButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <ArrowLeft size={18} color="#2563EB" strokeWidth={2.5} />
                    <Text className="text-[15px] font-semibold text-brand-primary">Back</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
              </View>
            ) : (
              <>
                {/* Onboarding mode header */}
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
              </>
            )}

            <View style={styles.contentWidth}>
              <View style={[styles.titleBlock, isSettings && styles.settingsTitleBlock]}>
                <Text className="text-3xl font-extrabold text-text-primary">{title}</Text>
                {subtitle ? (
                  <Text className="text-base leading-6 text-text-secondary">{subtitle}</Text>
                ) : null}
              </View>

              {children}
            </View>

            <View style={styles.flexSpacer} />

            {footer ? <View style={[styles.contentWidth, styles.footer]}>{footer}</View> : null}
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardAvoid: {
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
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingsBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingRight: 12,
  },
  settingsTitleBlock: {
    marginTop: 4,
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
  contentWidth: {
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
  },
  titleBlock: {
    gap: 8,
    marginTop: 12,
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: 20,
  },
  footer: {
    // paddingBottom: 8, // Removed to match SetupQuestionsTemplate
  },
});
