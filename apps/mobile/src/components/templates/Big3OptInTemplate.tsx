import { Text, View, Pressable } from 'react-native';
import { SetupStepLayout } from '@/components/organisms';
import { GradientButton } from '@/components/atoms';
import { ListChecks, Sparkles, Target } from 'lucide-react-native';

interface Big3OptInTemplateProps {
  step?: number;
  totalSteps?: number;
  onEnable: () => void;
  onSkip: () => void;
  onBack?: () => void;
}

export const Big3OptInTemplate = ({
  step,
  totalSteps,
  onEnable,
  onSkip,
  onBack,
}: Big3OptInTemplateProps) => {
  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Big 3 Daily Priorities"
      subtitle="Focus on what matters most each day."
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton label="Yes, enable Big 3" onPress={onEnable} />
          <Pressable
            onPress={onSkip}
            className="items-center py-3"
          >
            <Text className="text-base text-gray-500">No thanks, skip</Text>
          </Pressable>
        </View>
      }
    >
      <View className="flex-1 px-2 pt-4">
        {/* Explanation */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Target size={32} color="#2563EB" />
          </View>
          <Text className="mb-3 text-center text-lg font-semibold text-gray-900">
            What is the Big 3?
          </Text>
          <Text className="text-center text-base leading-6 text-gray-600">
            Each morning, pick 3 things that would make today a success. The app
            tracks how much time you spend on each priority throughout the day.
          </Text>
        </View>

        {/* Benefits */}
        <View className="gap-5">
          <View className="flex-row items-start gap-3">
            <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <ListChecks size={20} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900">Stay focused</Text>
              <Text className="text-sm leading-5 text-gray-500">
                Know exactly what to work on instead of reacting to whatever comes up.
              </Text>
            </View>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="mt-0.5 h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <Sparkles size={20} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900">See your progress</Text>
              <Text className="text-sm leading-5 text-gray-500">
                Track time spent on each priority and celebrate when all 3 are done.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SetupStepLayout>
  );
};
