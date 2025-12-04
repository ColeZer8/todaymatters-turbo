import { useMemo } from 'react';
import { ArrowRight, Plus, Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GradientButton } from '@/components/atoms';
import { SelectablePill } from '@/components/molecules';
import { SetupStepLayout } from '@/components/organisms';
import { ONBOARDING_TOTAL_STEPS } from '@/constants/onboarding';

type TemplateTone = 'primary' | 'danger';

export interface CategoryOption {
  category: string;
  options: string[];
  emoji?: string;
}

interface TagSelectionTemplateProps {
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  placeholder: string;
  options: string[] | CategoryOption[];
  selectedOptions: string[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onToggleOption: (value: string) => void;
  onAddOption?: (value: string) => void;
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
  onAddOption,
  onContinue,
  onBack,
  tone = 'primary',
}: TagSelectionTemplateProps) => {
  // Check if options are categorized or flat
  const isCategorized = options.length > 0 && typeof options[0] === 'object' && 'category' in options[0];
  
  // Flatten all options for search filtering
  const allOptions = useMemo(() => {
    if (isCategorized) {
      return (options as CategoryOption[]).flatMap((cat) => cat.options);
    }
    return options as string[];
  }, [options, isCategorized]);

  const filteredOptions = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return options;
    
    if (isCategorized) {
      // Filter categorized options
      return (options as CategoryOption[]).map((cat) => ({
        ...cat,
        options: cat.options.filter((option) => option.toLowerCase().includes(query)),
      })).filter((cat) => cat.options.length > 0);
    }
    
    // Filter flat options
    return (options as string[]).filter((option) => option.toLowerCase().includes(query));
  }, [options, searchValue, isCategorized]);

  // Check if search value doesn't match any existing option
  const showAddOption = useMemo(() => {
    if (!searchValue.trim() || !onAddOption) return false;
    const query = searchValue.trim().toLowerCase();
    const normalizedSearch = searchValue.trim();
    // Check if exact match exists (case-insensitive)
    const exactMatch = allOptions.some((opt) => opt.toLowerCase() === query);
    return !exactMatch && normalizedSearch.length > 0;
  }, [searchValue, allOptions, onAddOption]);

  const handleAddOption = () => {
    const trimmedValue = searchValue.trim();
    if (trimmedValue && onAddOption) {
      onAddOption(trimmedValue);
      onSearchChange('');
    }
  };

  const toneColors = {
    primary: {
      bg: '#EFF6FF',
      border: '#DBEAFE',
      text: '#2563EB',
      selectedBg: '#3B82F6',
    },
    danger: {
      bg: '#FEF2F2',
      border: '#FEE2E2',
      text: '#EF4444',
      selectedBg: '#EF4444',
    },
  };

  const colors = toneColors[tone];

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
            autoCapitalize="words"
            autoCorrect={false}
            onSubmitEditing={showAddOption ? handleAddOption : undefined}
            returnKeyType={showAddOption ? 'done' : 'search'}
          />
          {showAddOption && (
            <Pressable
              onPress={handleAddOption}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel={`Add ${searchValue.trim()}`}
            >
              <Plus size={18} color={colors.text} />
              <Text style={[styles.addButtonText, { color: colors.text }]}>Add</Text>
            </Pressable>
          )}
        </View>

        {showAddOption && (
          <View style={styles.addOptionSection}>
            <Pressable
              onPress={handleAddOption}
              style={[
                styles.addOptionCard,
                { borderColor: colors.border, backgroundColor: colors.bg },
              ]}
            >
              <Plus size={20} color={colors.text} style={styles.addOptionIcon} />
              <View style={styles.addOptionTextContainer}>
                <Text style={[styles.addOptionTitle, { color: colors.text }]}>
                  Add "{searchValue.trim()}"
                </Text>
                <Text style={styles.addOptionSubtitle}>Create a custom option</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Selected Items Section - shown at top when items are selected */}
        {selectedOptions.length > 0 && (
          <View style={styles.selectedSection}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedTitle}>Your selections</Text>
              <Text style={styles.selectedCount}>{selectedOptions.length}</Text>
            </View>
            <View style={styles.selectedPillWrap}>
              {selectedOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => onToggleOption(option)}
                  style={[styles.selectedPill, { backgroundColor: colors.selectedBg }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${option}`}
                >
                  <Text style={styles.selectedPillText}>{option}</Text>
                  <X size={14} color="#fff" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {isCategorized ? (
          <View style={styles.categorizedWrap}>
            {(filteredOptions as CategoryOption[]).map((category) => (
              <View key={category.category} style={styles.categorySection}>
                <View style={styles.categoryTitleRow}>
                  {category.emoji && (
                    <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                  )}
                  <Text style={styles.categoryTitle}>{category.category}</Text>
                </View>
                <View style={styles.pillWrap}>
                  {category.options.map((option) => {
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
            ))}
          </View>
        ) : (
          <View style={styles.pillWrap}>
            {(filteredOptions as string[]).map((option) => {
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
        )}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addOptionSection: {
    marginBottom: 8,
  },
  addOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  addOptionIcon: {
    marginRight: 4,
  },
  addOptionTextContainer: {
    flex: 1,
    gap: 2,
  },
  addOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  addOptionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  selectedSection: {
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  selectedPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 20,
  },
  selectedPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  categorizedWrap: {
    gap: 24,
  },
  categorySection: {
    gap: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});
