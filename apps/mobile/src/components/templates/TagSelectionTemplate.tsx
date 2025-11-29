import { useMemo } from 'react';
import { ArrowRight, Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SelectablePill } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

type TemplateTone = 'primary' | 'danger';

interface TagSelectionTemplateProps {
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  placeholder: string;
  options: string[];
  selectedOptions: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onToggleOption: (value: string) => void;
  onContinue: () => void;
  onBack?: () => void;
  tone?: TemplateTone;
}

export const TagSelectionTemplate = ({
  step = 4,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  title,
  subtitle,
  placeholder,
  options,
  selectedOptions,
  searchValue,
  onSearchChange,
  onToggleOption,
  onContinue,
  onBack,
  tone = 'primary',
}: TagSelectionTemplateProps) => {
  const filteredOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, searchValue]);

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      footer={
        <GradientButton label="Continue" onPress={onContinue} rightIcon={ArrowRight} />
      }
    >
      <View style={styles.stack}>
        <View style={styles.searchField}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            accessibilityLabel={placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.pillWrap}>
          {filteredOptions.map((option) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <SelectablePill
                key={option}
                label={option}
                selected={isSelected}
                onPress={() => onToggleOption(option)}
                tone={tone}
              />
            );
          })}
        </View>
      </View>
    </SetupStepLayout>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    marginTop: 12,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
