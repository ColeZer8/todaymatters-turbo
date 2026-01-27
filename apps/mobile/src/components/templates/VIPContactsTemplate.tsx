import { useState } from "react";
import {
  ArrowRight,
  Plus,
  X,
  Users,
  Heart,
  Briefcase,
  User,
  Phone,
  Mail,
} from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { GradientButton } from "@/components/atoms";
import { SetupStepLayout } from "@/components/organisms";
import {
  ONBOARDING_STEPS,
  ONBOARDING_TOTAL_STEPS,
} from "@/constants/onboarding";
import type { VIPContact, VIPRelationship } from "@/stores/onboarding-store";

interface VIPContactsTemplateProps {
  step?: number;
  totalSteps?: number;
  contacts: VIPContact[];
  onAddContact: (contact: Omit<VIPContact, "id">) => void;
  onRemoveContact: (contactId: string) => void;
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
}

const RELATIONSHIP_OPTIONS: {
  value: VIPRelationship;
  label: string;
  icon: typeof Users;
}[] = [
  { value: "spouse", label: "Spouse", icon: Heart },
  { value: "child", label: "Child", icon: Users },
  { value: "parent", label: "Parent", icon: Users },
  { value: "friend", label: "Friend", icon: User },
  { value: "colleague", label: "Colleague", icon: Briefcase },
  { value: "other", label: "Other", icon: User },
];

const cardShadowStyle = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.05,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
};

const getRelationshipColor = (relationship: VIPRelationship) => {
  const colors: Record<VIPRelationship, string> = {
    spouse: "#EC4899",
    child: "#F59E0B",
    parent: "#8B5CF6",
    friend: "#10B981",
    colleague: "#3B82F6",
    other: "#6B7280",
  };
  return colors[relationship] || "#6B7280";
};

export const VIPContactsTemplate = ({
  step = ONBOARDING_STEPS.vipContacts,
  totalSteps = ONBOARDING_TOTAL_STEPS,
  contacts,
  onAddContact,
  onRemoveContact,
  onContinue,
  onSkip,
  onBack,
}: VIPContactsTemplateProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] =
    useState<VIPRelationship>("spouse");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const handleAddContact = () => {
    if (newName.trim()) {
      onAddContact({
        name: newName.trim(),
        relationship: newRelationship,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setIsAdding(false);
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewRelationship("spouse");
    setNewPhone("");
    setNewEmail("");
    setIsAdding(false);
  };

  return (
    <SetupStepLayout
      step={step}
      totalSteps={totalSteps}
      title="Your VIP Contacts"
      subtitle="Who are the most important people in your life?"
      onBack={onBack}
      footer={
        <View className="gap-3">
          <GradientButton
            label="Continue"
            onPress={onContinue}
            rightIcon={ArrowRight}
          />
          {onSkip && (
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              className="items-center py-2"
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
              <Text className="text-sm font-semibold text-[#94A3B8]">
                Skip for now
              </Text>
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
            Add the people who matter most - family, close friends, key
            colleagues. We'll help you prioritize time with them.
          </Text>
        </View>

        {/* Contacts List */}
        {contacts.length > 0 && (
          <View className="gap-3">
            {contacts.map((contact) => {
              const color = getRelationshipColor(contact.relationship);
              return (
                <View
                  key={contact.id}
                  className="flex-row items-center rounded-2xl border border-[#E4E8F0] bg-white px-4 py-3"
                  style={cardShadowStyle}
                >
                  <View
                    className="h-11 w-11 items-center justify-center rounded-xl mr-3"
                    style={{ backgroundColor: color + "20" }}
                  >
                    <Text className="text-lg font-bold" style={{ color }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-text-primary">
                      {contact.name}
                    </Text>
                    <Text className="text-xs capitalize" style={{ color }}>
                      {contact.relationship}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${contact.name}`}
                    onPress={() => onRemoveContact(contact.id)}
                    className="h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2]"
                    style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                  >
                    <X size={14} color="#EF4444" />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Add Contact Form */}
        {isAdding ? (
          <View
            className="rounded-2xl border border-[#E4E8F0] bg-white p-4"
            style={cardShadowStyle}
          >
            <Text className="text-base font-semibold text-text-primary mb-4">
              Add VIP Contact
            </Text>

            {/* Name */}
            <View className="mb-3">
              <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
                NAME
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Full name"
                placeholderTextColor="#94A3B8"
                autoFocus
                className="rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm text-text-primary"
                style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
              />
            </View>

            {/* Relationship */}
            <View className="mb-3">
              <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
                RELATIONSHIP
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {RELATIONSHIP_OPTIONS.map((option) => {
                  const isSelected = newRelationship === option.value;
                  const color = getRelationshipColor(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => setNewRelationship(option.value)}
                      className={`rounded-full px-3 py-2 ${
                        isSelected ? "border-2" : "border border-[#E4E8F0]"
                      }`}
                      style={{
                        backgroundColor: isSelected ? color + "15" : "#fff",
                        borderColor: isSelected ? color : "#E4E8F0",
                      }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? color : "#64748B" }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Phone (Optional) */}
            <View className="mb-3">
              <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
                PHONE <Text className="text-[#C7D2FE]">(optional)</Text>
              </Text>
              <View
                className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4"
                style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
              >
                <Phone size={16} color="#94A3B8" />
                <TextInput
                  value={newPhone}
                  onChangeText={setNewPhone}
                  placeholder="Phone number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  className="flex-1 py-3 ml-2 text-sm text-text-primary"
                />
              </View>
            </View>

            {/* Email (Optional) */}
            <View className="mb-4">
              <Text className="text-xs font-semibold text-[#94A3B8] mb-1.5">
                EMAIL <Text className="text-[#C7D2FE]">(optional)</Text>
              </Text>
              <View
                className="flex-row items-center rounded-xl bg-[#F8FAFC] px-4"
                style={{ borderWidth: 1, borderColor: "#E2E8F0" }}
              >
                <Mail size={16} color="#94A3B8" />
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Email address"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="flex-1 py-3 ml-2 text-sm text-text-primary"
                />
              </View>
            </View>

            {/* Actions */}
            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                onPress={resetForm}
                className="flex-1 items-center py-3 rounded-xl bg-[#F1F5F9]"
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
              >
                <Text className="text-sm font-semibold text-[#64748B]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleAddContact}
                disabled={!newName.trim()}
                className="flex-1 items-center py-3 rounded-xl bg-brand-primary"
                style={({ pressed }) => [
                  { opacity: !newName.trim() ? 0.5 : pressed ? 0.9 : 1 },
                ]}
              >
                <Text className="text-sm font-semibold text-white">
                  Add Contact
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsAdding(true)}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F8FAFF] px-4 py-4"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <Plus size={18} color="#2563EB" />
            <Text className="text-base font-semibold text-brand-primary">
              Add VIP Contact
            </Text>
          </Pressable>
        )}
      </View>
    </SetupStepLayout>
  );
};
