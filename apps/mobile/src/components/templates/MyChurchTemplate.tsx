import { ArrowRight, Church, MapPin, Globe } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

interface MyChurchTemplateProps {
  step?: number;
  totalSteps?: number;
  churchName: string;
  churchAddress: string;
  churchWebsite: string;
  onChangeChurchName: (value: string) => void;
  onChangeChurchAddress: (value: string) => void;
  onChangeChurchWebsite: (value: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const cardShadowStyle = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const MyChurchTemplate = ({
  step = ONBOARDING_STEPS.myChurch,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  churchName,
  churchAddress,
  churchWebsite,
  onChangeChurchName,
  onChangeChurchAddress,
  onChangeChurchWebsite,
  onContinue,
  onSkip,
  onBack,
}: MyChurchTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Your Church"
      subtitle="Tell us about your place of worship."
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />
          {onSkip && (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="items-center py-2"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-sm font-semibold text-[#94A3B8]">Skip for now</Text>
            </Pressable>
          )}
        </View>
      }
    >
      <View className="mt-2 gap-4">
        {/* Info Card */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-[#F5F9FF] px-4 py-3"
          style={cardShadowStyle}
        >
          <Text className="text-sm leading-5 text-text-secondary">
            If faith is one of your core values, knowing your church helps us understand
            your spiritual community and routine.
          </Text>
        </View>

        {/* Form */}
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-white p-4"
          style={cardShadowStyle}
        >
          {/* Church Name */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">CHURCH NAME</Text>
            <View className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4" style={{ borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Church size={18} color="#94A3B8" />
              <TextInput
                value={churchName}
                onChangeText={onChangeChurchName}
                placeholder="e.g., First Baptist Church"
                placeholderTextColor="#94A3B8"
                className="flex-1 py-3 ml-3 text-[15px] text-text-primary"
              />
            </View>
          </View>

          {/* Address */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
              ADDRESS <Text className="text-[#C7D2FE]">(optional)</Text>
            </Text>
            <View className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4" style={{ borderWidth: 1, borderColor: '#E2E8F0' }}>
              <MapPin size={18} color="#94A3B8" />
              <TextInput
                value={churchAddress}
                onChangeText={onChangeChurchAddress}
                placeholder="Street address, city"
                placeholderTextColor="#94A3B8"
                className="flex-1 py-3 ml-3 text-[15px] text-text-primary"
              />
            </View>
          </View>

          {/* Website */}
          <View>
            <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
              WEBSITE <Text className="text-[#C7D2FE]">(optional)</Text>
            </Text>
            <View className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4" style={{ borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Globe size={18} color="#94A3B8" />
              <TextInput
                value={churchWebsite}
                onChangeText={onChangeChurchWebsite}
                placeholder="www.yourchurch.com"
                placeholderTextColor="#94A3B8"
                keyboardType="url"
                autoCapitalize="none"
                className="flex-1 py-3 ml-3 text-[15px] text-text-primary"
              />
            </View>
          </View>
        </View>

        {/* Footer Note */}
        <Text className="text-xs text-center text-[#94A3B8] px-4">
          All fields are optional. You can always update this later in your profile.
        </Text>
      </View>
    </SetupStepLayout>
  );
};
