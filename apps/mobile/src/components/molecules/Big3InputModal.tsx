import { useState } from "react";
import { Modal, View, Text, TextInput, Pressable } from "react-native";

interface Big3InputModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (p1: string, p2: string, p3: string) => void;
}

export const Big3InputModal = ({
  visible,
  onClose,
  onSave,
}: Big3InputModalProps) => {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [p3, setP3] = useState("");

  const handleSave = () => {
    if (p1.trim() || p2.trim() || p3.trim()) {
      onSave(p1.trim(), p2.trim(), p3.trim());
      // Clear inputs
      setP1("");
      setP2("");
      setP3("");
      onClose();
    }
  };

  const handleCancel = () => {
    setP1("");
    setP2("");
    setP3("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl bg-white p-6">
          <Text className="text-[18px] font-bold text-[#111827]">
            Set your Big 3 for today
          </Text>
          <Text className="mt-2 text-[14px] text-[#64748B]">
            Pick 3 things that would make today a success.
          </Text>

          <View className="mt-6 gap-3">
            {[
              { num: 1, value: p1, onChange: setP1 },
              { num: 2, value: p2, onChange: setP2 },
              { num: 3, value: p3, onChange: setP3 },
            ].map((item) => (
              <View key={item.num} className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-[#E2E8F0]">
                  <Text className="text-[13px] font-bold text-[#64748B]">
                    {item.num}
                  </Text>
                </View>
                <TextInput
                  value={item.value}
                  onChangeText={item.onChange}
                  placeholder={`Priority ${item.num}`}
                  placeholderTextColor="#94A3B8"
                  className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#111827]"
                  autoCapitalize="sentences"
                  returnKeyType={item.num === 3 ? "done" : "next"}
                />
              </View>
            ))}
          </View>

          <View className="mt-6 flex-row justify-end gap-3">
            <Pressable onPress={handleCancel} className="rounded-lg px-5 py-3">
              <Text className="text-[15px] font-semibold text-[#6B7280]">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              className="rounded-lg bg-[#2563EB] px-5 py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-[15px] font-bold text-white">
                Save Big 3
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
