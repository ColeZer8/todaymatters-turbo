import { ArrowRight } from "lucide-react-native";
import { Text, TextInput, View } from "react-native";
import { GradientButton } from "@/components/atoms";
import { SetupStepLayout } from "@/components/organisms";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";

interface NameTemplateProps {
  step?: number;
  totalSteps?: number;
  fullName: string;
  onChangeFullName: (text: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  isContinueDisabled?: boolean;
}

const cardShadowStyle = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

export const NameTemplate = ({
  step = ONBOARDING_STEPS.name,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  fullName,
  onChangeFullName,
  onContinue,
  onBack,
  isContinueDisabled = false,
}: NameTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Your name"
      subtitle="So we can greet you in a way that feels personal."
      onBack={onBack}
      footer={
        <GradientButton
          label="Continue"
          onPress={onContinue}
          rightIcon={ArrowRight}
          disabled={isContinueDisabled}
        />
      }
    >
      <View className="mt-4 gap-4">
        <View
          className="rounded-2xl border border-[#E4E8F0] bg-white px-4 py-4"
          style={cardShadowStyle}
        >
          <Text className="text-base font-semibold text-text-primary">
            What should we call you?
          </Text>
          <Text className="mt-1 text-sm leading-5 text-text-secondary">
            You can change this anytime in Profile.
          </Text>

          <TextInput
            value={fullName}
            onChangeText={onChangeFullName}
            placeholder="Full name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            returnKeyType="done"
            className="mt-4 h-12 rounded-2xl border border-[#D1DBEC] bg-white px-4 text-base font-semibold text-text-primary"
            accessibilityLabel="Full name"
          />
        </View>
      </View>
    </SetupStepLayout>
  );
};
