import { GradientButton } from '@/components/atoms';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, CheckSquare, ChevronDown } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PermissionsTemplateProps {
  allowAllEnabled: boolean;
  onToggleAllowAll: () => void;
  onContinue: () => void;
  onCustomizeLater: () => void;
  step?: number;
  totalSteps?: number;
}

export const PermissionsTemplate = ({
  allowAllEnabled,
  onToggleAllowAll,
  onContinue,
  onCustomizeLater,
  step = 1,
  totalSteps = 5,
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
            <Text className="text-sm font-semibold text-brand-primary">Step {step} of {totalSteps}</Text>
            <Text className="text-sm font-semibold text-text-secondary">Setup</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={styles.titleBlock}>
            <Text className="text-3xl font-extrabold text-text-primary">Sync your day in the background</Text>
            <Text className="mt-3 text-base leading-6 text-text-secondary">
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

          <GradientButton
            label="Allow & continue"
            onPress={onContinue}
            rightIcon={ArrowRight}
          />

          <Pressable
            accessibilityRole="button"
            onPress={onCustomizeLater}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, styles.customizeLater]}
          >
            <Text className="text-lg font-semibold text-text-primary">Customize later</Text>
            <Text className="mt-2 text-sm text-text-secondary">You can change permissions anytime in settings.</Text>
          </Pressable>
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
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    width: '20%',
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
  titleBlock: {
    marginTop: 6,
  },
  permissionsHeader: {
    gap: 4,
    marginBottom: 4,
  },
  headerUnderline: {
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
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  allowIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 12,
  },
  allowTextBlock: {
    flex: 1,
  },
  toggleShell: {
    width: 46,
    height: 28,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignSelf: 'flex-start',
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
  customizeLater: {
    alignItems: 'center',
  },
});
