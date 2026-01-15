import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Church, Globe, MapPin, Plus } from 'lucide-react-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';
import { formatChurchOptionLabel, type ChurchOption } from '@/constants/churches';

interface MyChurchTemplateProps {
  step?: number;
  totalSteps?: number;
  churchName: string;
  churchAddress: string;
  churchWebsite: string;
  onChangeChurchName: (value: string) => void;
  onChangeChurchAddress: (value: string) => void;
  onChangeChurchWebsite: (value: string) => void;
  churchOptions?: ChurchOption[];
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
  churchOptions = [],
  onContinue,
  onSkip,
  onBack,
}: MyChurchTemplateProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);

  const trimmedQuery = churchName.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return [];
    const results = churchOptions.filter((c) => {
      const label = formatChurchOptionLabel(c).toLowerCase();
      return label.includes(normalizedQuery);
    });
    return results.slice(0, 12);
  }, [churchOptions, normalizedQuery]);

  const showDropdown =
    !isManualEntry && isDropdownOpen && normalizedQuery.length > 0 && filteredOptions.length > 0;

  const showNoResults =
    !isManualEntry && isDropdownOpen && normalizedQuery.length >= 2 && filteredOptions.length === 0;

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
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-[#94A3B8]">CHURCH</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsManualEntry((prev) => !prev);
                  setIsDropdownOpen(false);
                }}
                className="rounded-full bg-[#F1F5F9] px-3 py-1"
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <Text className="text-[12px] font-semibold text-text-secondary">
                  {isManualEntry ? 'Use dropdown' : "Can't find it?"}
                </Text>
              </Pressable>
            </View>
            <View
              className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4"
              style={{ borderWidth: 1, borderColor: '#E2E8F0' }}
            >
              <Church size={18} color="#94A3B8" />
              <TextInput
                value={churchName}
                onChangeText={(value) => {
                  onChangeChurchName(value);
                  if (!isManualEntry) setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  if (!isManualEntry) setIsDropdownOpen(true);
                }}
                onBlur={() => {
                  // Let taps on results register before closing.
                  setTimeout(() => setIsDropdownOpen(false), 150);
                }}
                placeholder={isManualEntry ? "Enter your church name" : 'Search churches…'}
                placeholderTextColor="#94A3B8"
                className="flex-1 py-3 ml-3 text-[15px] text-text-primary"
              />
              {!isManualEntry ? (
                <ChevronDown size={18} color="#94A3B8" />
              ) : (
                <View className="h-4 w-4" />
              )}
            </View>

            {/* Dropdown results */}
            {showDropdown ? (
              <View
                className="mt-2 overflow-hidden rounded-xl border border-[#E4E8F0] bg-white"
                style={cardShadowStyle}
              >
                {filteredOptions.map((item, index) => {
                  const label = formatChurchOptionLabel(item);
                  const isSelected = label === churchName;
                  return (
                    <View key={item.id}>
                      {index > 0 ? <View className="h-px bg-[#E2E8F0]" /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          onChangeChurchName(label);
                          setIsDropdownOpen(false);
                        }}
                        className="flex-row items-center justify-between px-4 py-3"
                        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                      >
                        <Text className="text-[15px] font-semibold text-text-primary">
                          {label}
                        </Text>
                        {isSelected ? <Check size={18} color="#2563EB" /> : <View className="h-4 w-4" />}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {showNoResults ? (
              <View className="mt-2 flex-row items-center justify-between rounded-xl bg-[#F8FAFF] px-4 py-3">
                <Text className="text-sm text-text-secondary">
                  No matches. You can add it manually.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsManualEntry(true);
                    setIsDropdownOpen(false);
                  }}
                  className="flex-row items-center gap-1 rounded-full bg-white px-3 py-1"
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Text className="text-[12px] font-semibold text-brand-primary">Add</Text>
                  <Plus size={14} color="#2563EB" />
                </Pressable>
              </View>
            ) : null}
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
