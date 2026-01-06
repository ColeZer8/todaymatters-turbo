import { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Flag, Calendar, Clock, Sun, Heart, Briefcase, Dumbbell } from 'lucide-react-native';
import { Icon } from '../atoms/Icon';
import { useOnboardingStore } from '@/stores';
import type { ScheduledEvent, EventCategory } from '@/stores';

// Life areas with icons - simplified from full category list
const LIFE_AREAS: Array<{ id: EventCategory; label: string; icon: typeof Sun }> = [
    { id: 'routine', label: 'Faith', icon: Sun },
    { id: 'family', label: 'Family', icon: Heart },
    { id: 'work', label: 'Work', icon: Briefcase },
    { id: 'health', label: 'Health', icon: Dumbbell },
];

// Helper to format minutes to display time
const formatTime = (minutes: number): string => {
    const hours24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
};

interface EventEditorModalProps {
    event: ScheduledEvent | null;
    visible: boolean;
    onClose: () => void;
    onSave?: (updates: { title?: string; category?: EventCategory; isBig3?: boolean }) => void | Promise<void>;
    onDelete?: () => void | Promise<void>;
}

export const EventEditorModal = ({ event, visible, onClose, onSave, onDelete }: EventEditorModalProps) => {
    const insets = useSafeAreaInsets();
    const { joySelections, goals, initiatives } = useOnboardingStore();
    
    // Animated values for backdrop fade and panel slide
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const panelTranslateY = useRef(new Animated.Value(500)).current;
    
    useEffect(() => {
        if (visible) {
            // Run both animations in parallel: fade backdrop + slide panel
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(panelTranslateY, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            backdropOpacity.setValue(0);
            panelTranslateY.setValue(500);
        }
    }, [visible, backdropOpacity, panelTranslateY]);
    
    // Local draft state
    const [selectedCategory, setSelectedCategory] = useState<EventCategory>(event?.category || 'work');
    const [isBig3, setIsBig3] = useState(event?.isBig3 || false);
    const [selectedValue, setSelectedValue] = useState<string | null>(null);
    const [title, setTitle] = useState(event?.title || '');
    
    // Sync title when event changes
    useEffect(() => {
        if (event?.title) {
            setTitle(event.title);
        }
    }, [event?.title]);
    
    // Combine joy selections as "values" - use defaults if empty
    const values = joySelections.length > 0 
        ? joySelections 
        : ['Family', 'Integrity', 'Creativity'];
    
    // Combine goals and initiatives
    const allGoals = [...goals, ...initiatives].filter(Boolean);
    
    if (!event) return null;
    
    const timeRange = `${formatTime(event.startMinutes)} - ${formatTime(event.startMinutes + event.duration)}`;
    
    const handleSave = () => {
        void onSave?.({
            title: title.trim(),
            category: selectedCategory,
            isBig3,
        });
    };
    
    const handleToggleBig3 = () => {
        setIsBig3(!isBig3);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end">
                {/* Animated backdrop - fades in */}
                <Animated.View 
                    className="absolute inset-0 bg-black/40"
                    style={{ opacity: backdropOpacity }}
                />
                {/* Panel - slides up */}
                <Animated.View 
                    className="bg-white rounded-t-3xl"
                    style={{ 
                        paddingBottom: insets.bottom + 16,
                        transform: [{ translateY: panelTranslateY }],
                    }}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-end px-6 pt-5 pb-2">
                        <Pressable 
                            onPress={onClose}
                            className="h-9 w-9 items-center justify-center rounded-full bg-[#F1F5F9]"
                        >
                            <Icon icon={X} size={18} color="#64748B" />
                        </Pressable>
                    </View>
                    
                    <ScrollView 
                        className="px-6"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        {/* Title Section */}
                        <View className="mt-2">
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Enter title..."
                                placeholderTextColor="#94A3B8"
                                className="text-3xl font-extrabold text-[#111827]"
                                multiline
                            />
                        </View>
                        
                        {/* Date & Time Pills */}
                        <View className="mt-6 flex-row gap-3">
                            <View className="flex-row items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2.5">
                                <Icon icon={Calendar} size={16} color="#2563EB" />
                                <Text className="text-sm font-semibold text-[#2563EB]">Nov 8</Text>
                            </View>
                            <View className="flex-row items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#FFF7ED] px-4 py-2.5">
                                <Icon icon={Clock} size={16} color="#F97316" />
                                <Text className="text-sm font-medium text-[#78716C]">{timeRange}</Text>
                            </View>
                        </View>
                        
                        {/* Mark as Big 3 */}
                        <Pressable 
                            onPress={handleToggleBig3}
                            className={`mt-5 flex-row items-center gap-2 self-start rounded-full border px-4 py-2.5 ${
                                isBig3 
                                    ? 'border-[#FCD34D] bg-[#FFFBEB]' 
                                    : 'border-[#E2E8F0] bg-white'
                            }`}
                        >
                            <Icon icon={Flag} size={16} color={isBig3 ? '#F59E0B' : '#94A3B8'} />
                            <Text className={`text-sm font-semibold ${isBig3 ? 'text-[#D97706]' : 'text-[#94A3B8]'}`}>
                                Mark as Big 3
                            </Text>
                        </Pressable>
                        
                        {/* Life Area */}
                        <View className="mt-8">
                            <Text className="text-xs font-semibold tracking-wider text-[#F97316]">
                                LIFE AREA
                            </Text>
                            <View className="mt-3 flex-row flex-wrap gap-2">
                                {LIFE_AREAS.map((area) => {
                                    const isSelected = selectedCategory === area.id;
                                    return (
                                        <Pressable
                                            key={area.id}
                                            onPress={() => setSelectedCategory(area.id)}
                                            className={`flex-row items-center gap-2 rounded-full border px-4 py-2.5 ${
                                                isSelected 
                                                    ? 'border-[#2563EB] bg-[#EFF6FF]' 
                                                    : 'border-[#E2E8F0] bg-white'
                                            }`}
                                        >
                                            <Icon 
                                                icon={area.icon} 
                                                size={16} 
                                                color={isSelected ? '#2563EB' : '#94A3B8'} 
                                            />
                                            <Text className={`text-sm font-semibold ${
                                                isSelected ? 'text-[#2563EB]' : 'text-[#64748B]'
                                            }`}>
                                                {area.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                        
                        {/* Align with Values */}
                        <View className="mt-8">
                            <Text className="text-xs font-semibold tracking-wider text-[#94A3B8]">
                                ALIGN WITH VALUES
                            </Text>
                            <View className="mt-3 flex-row flex-wrap gap-2">
                                {values.slice(0, 4).map((value) => {
                                    const isSelected = selectedValue === value;
                                    return (
                                        <Pressable
                                            key={value}
                                            onPress={() => setSelectedValue(isSelected ? null : value)}
                                            className={`rounded-full border px-4 py-2.5 ${
                                                isSelected 
                                                    ? 'border-[#1E293B] bg-[#1E293B]' 
                                                    : 'border-[#E2E8F0] bg-white'
                                            }`}
                                        >
                                            <Text className={`text-sm font-semibold ${
                                                isSelected ? 'text-white' : 'text-[#64748B]'
                                            }`}>
                                                {value}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                                <Pressable className="rounded-full border border-dashed border-[#CBD5E1] px-4 py-2.5">
                                    <Text className="text-sm font-semibold text-[#94A3B8]">+ Add</Text>
                                </Pressable>
                            </View>
                        </View>
                        
                        {/* Goals (if any) */}
                        {allGoals.length > 0 && (
                            <View className="mt-8">
                                <Text className="text-xs font-semibold tracking-wider text-[#94A3B8]">
                                    LINKED GOAL
                                </Text>
                                <View className="mt-3 flex-row flex-wrap gap-2">
                                    {allGoals.slice(0, 3).map((goal) => (
                                        <View
                                            key={goal}
                                            className="rounded-full border border-[#E2E8F0] bg-white px-4 py-2.5"
                                        >
                                            <Text className="text-sm font-semibold text-[#64748B]">
                                                {goal}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                    
                    {/* Footer Actions */}
                    <View className="px-6 pt-4">
                        <Pressable 
                            onPress={handleSave}
                            className="items-center rounded-2xl bg-[#2563EB] py-4"
                        >
                            <Text className="text-base font-bold text-white">Save Changes</Text>
                        </Pressable>
                        
                        <Pressable 
                            onPress={() => {
                                if (onDelete) {
                                    void onDelete();
                                    return;
                                }
                                onClose();
                            }}
                            className="mt-3 items-center py-3"
                        >
                            <Text className="text-sm font-semibold text-[#CBD5E1]">Delete Event</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};
