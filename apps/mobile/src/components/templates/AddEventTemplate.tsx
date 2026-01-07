import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Flag, Calendar, Clock, Sun, Heart, Briefcase, Dumbbell, ChevronRight, Check } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Icon } from '../atoms/Icon';
import { useOnboardingStore } from '@/stores';
import type { EventCategory } from '@/stores';
import { LocationSearchModal } from '../molecules/LocationSearchModal';

// Life areas with icons - same as EventEditorModal
const LIFE_AREAS: Array<{ id: EventCategory; label: string; icon: typeof Sun }> = [
    { id: 'routine', label: 'Faith', icon: Sun },
    { id: 'family', label: 'Family', icon: Heart },
    { id: 'work', label: 'Work', icon: Briefcase },
    { id: 'health', label: 'Health', icon: Dumbbell },
];

const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

interface AddEventDraft {
    title: string;
    location: string;
    category: EventCategory;
    isBig3: boolean;
    selectedDate: Date;
    startTime: Date;
    endTime: Date;
}

interface AddEventTemplateProps {
    initialDate: Date;
    initialStartMinutes?: number;
    onClose: () => void;
    onSave: (draft: AddEventDraft) => void | Promise<void>;
}

export const AddEventTemplate = ({ initialDate, initialStartMinutes, onClose, onSave }: AddEventTemplateProps) => {
    const insets = useSafeAreaInsets();
    const { joySelections, goals, initiatives } = useOnboardingStore();
    
    // Local draft state
    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('work');
    const [isBig3, setIsBig3] = useState(false);
    const [selectedValue, setSelectedValue] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [selectedDate, setSelectedDate] = useState(initialDate);
    const [startTime, setStartTime] = useState(() => {
        const date = new Date(initialDate);
        if (initialStartMinutes !== undefined) {
            date.setHours(Math.floor(initialStartMinutes / 60), initialStartMinutes % 60, 0, 0);
        } else {
            date.setHours(9, 30, 0, 0);
        }
        return date;
    });
    const [endTime, setEndTime] = useState(() => {
        const date = new Date(initialDate);
        if (initialStartMinutes !== undefined) {
            const endMins = initialStartMinutes + 15;
            date.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
        } else {
            date.setHours(10, 30, 0, 0);
        }
        return date;
    });
    
    // Picker states
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [allDay, setAllDay] = useState(false);
    
    // Combine joy selections as "values" - use defaults if empty
    const values = joySelections.length > 0 
        ? joySelections 
        : ['Family', 'Integrity', 'Creativity'];
    
    // Combine goals and initiatives
    const allGoals = [...goals, ...initiatives].filter(Boolean);
    
    const handleSave = () => {
        void onSave({
            title,
            location,
            category: selectedCategory,
            isBig3,
            selectedDate,
            startTime,
            endTime,
        });
    };

    const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
        if (date) {
            setSelectedDate(date);
            // Also update start/end times to keep them on the same day if needed
            const newStart = new Date(date);
            newStart.setHours(startTime.getHours(), startTime.getMinutes());
            setStartTime(newStart);
            const newEnd = new Date(date);
            newEnd.setHours(endTime.getHours(), endTime.getMinutes());
            setEndTime(newEnd);
        }
    };

    const onStartTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        if (date) setStartTime(date);
    };

    const onEndTimeChange = (event: DateTimePickerEvent, date?: Date) => {
        if (date) setEndTime(date);
    };

    const toggleDatePicker = () => {
        setShowDatePicker(!showDatePicker);
        setShowStartTimePicker(false);
        setShowEndTimePicker(false);
    };

    const toggleStartTimePicker = () => {
        setShowStartTimePicker(!showStartTimePicker);
        setShowDatePicker(false);
        setShowEndTimePicker(false);
    };

    const toggleEndTimePicker = () => {
        setShowEndTimePicker(!showEndTimePicker);
        setShowDatePicker(false);
        setShowStartTimePicker(false);
    };

    return (
        <View 
            className="flex-1 bg-[#F2F2F7]"
            style={{ paddingBottom: insets.bottom }}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
                <Pressable onPress={onClose}>
                    <Text className="text-lg text-[#2563EB]">Cancel</Text>
                </Pressable>
                <Text className="text-lg font-bold text-[#111827]">New Event</Text>
                <Pressable onPress={handleSave}>
                    <Text className="text-lg font-bold text-[#2563EB]">Add</Text>
                </Pressable>
            </View>
            
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Title & Location Section */}
                <View className="mt-4 mx-4 overflow-hidden rounded-xl bg-white">
                    <View className="px-4 py-3">
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Title"
                            placeholderTextColor="#94A3B8"
                            className="text-lg text-[#111827]"
                        />
                    </View>
                    <View className="h-[1px] ml-4 bg-[#E5E5EA]" />
                    <Pressable 
                        onPress={() => setShowLocationPicker(true)}
                        className="px-4 py-3"
                    >
                        <Text className={`text-lg ${location ? 'text-[#111827]' : 'text-[#94A3B8]'}`}>
                            {location || 'Location or Video Call'}
                        </Text>
                    </Pressable>
                </View>

                {/* Time & Date Section */}
                <View className="mt-8 mx-4 overflow-hidden rounded-xl bg-white">
                    {/* All-day row */}
                    <View className="flex-row items-center justify-between px-4 py-3">
                        <Text className="text-lg text-[#111827]">All-day</Text>
                        <Switch
                            value={allDay}
                            onValueChange={setAllDay}
                            trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                        />
                    </View>
                    <View className="h-[1px] ml-4 bg-[#E5E5EA]" />
                    
                    {/* Starts Row */}
                    <Pressable 
                        onPress={toggleDatePicker}
                        className="flex-row items-center justify-between px-4 py-3"
                    >
                        <Text className="text-lg text-[#111827]">Starts</Text>
                        <View className="flex-row items-center gap-2">
                            <View className="rounded-lg bg-[#E5E5EA] px-2 py-1">
                                <Text className="text-lg text-[#111827]">{formatDateFull(selectedDate)}</Text>
                            </View>
                            {!allDay && (
                                <Pressable onPress={toggleStartTimePicker}>
                                    <View className={`rounded-lg px-2 py-1 ${showStartTimePicker ? 'bg-[#E5E5EA]' : 'bg-[#E5E5EA]'}`}>
                                        <Text className={`text-lg ${showStartTimePicker ? 'text-[#EF4444]' : 'text-[#111827]'}`}>
                                            {formatTime(startTime)}
                                        </Text>
                                    </View>
                                </Pressable>
                            )}
                        </View>
                    </Pressable>
                    
                    {/* Inline Date Picker */}
                    {showDatePicker && (
                        <View className="bg-white px-4 pb-4">
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="inline"
                                onChange={onDateChange}
                                themeVariant="light"
                            />
                        </View>
                    )}

                    {/* Inline Start Time Picker */}
                    {showStartTimePicker && !allDay && (
                        <View className="bg-white">
                            <View className="h-[1px] bg-[#E5E5EA]" />
                            <DateTimePicker
                                value={startTime}
                                mode="time"
                                display="spinner"
                                onChange={onStartTimeChange}
                                themeVariant="light"
                                style={{ height: 200 }}
                            />
                        </View>
                    )}

                    <View className="h-[1px] ml-4 bg-[#E5E5EA]" />

                    {/* Ends Row */}
                    {!allDay && (
                        <>
                            <Pressable 
                                onPress={toggleEndTimePicker}
                                className="flex-row items-center justify-between px-4 py-3"
                            >
                                <Text className="text-lg text-[#111827]">Ends</Text>
                                <View className="rounded-lg bg-[#E5E5EA] px-2 py-1">
                                    <Text className={`text-lg ${showEndTimePicker ? 'text-[#EF4444]' : 'text-[#111827]'}`}>
                                        {formatTime(endTime)}
                                    </Text>
                                </View>
                            </Pressable>
                            {showEndTimePicker && (
                                <View className="bg-white">
                                    <View className="h-[1px] bg-[#E5E5EA]" />
                                    <DateTimePicker
                                        value={endTime}
                                        mode="time"
                                        display="spinner"
                                        onChange={onEndTimeChange}
                                        themeVariant="light"
                                        style={{ height: 200 }}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Big 3 Section */}
                <View className="mt-8 mx-4 overflow-hidden rounded-xl bg-white">
                    <Pressable 
                        onPress={() => setIsBig3(!isBig3)}
                        className="flex-row items-center justify-between px-4 py-3"
                    >
                        <View className="flex-row items-center gap-3">
                            <Icon icon={Flag} size={20} color={isBig3 ? '#F59E0B' : '#8E8E93'} />
                            <Text className="text-lg text-[#111827]">Mark as Big 3</Text>
                        </View>
                        <Switch
                            value={isBig3}
                            onValueChange={setIsBig3}
                            trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                        />
                    </Pressable>
                </View>
                
                {/* Life Area */}
                <View className="mt-8 px-6">
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
                <View className="mt-8 px-6">
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
                    <View className="mt-8 px-6">
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

            <LocationSearchModal
                visible={showLocationPicker}
                onClose={() => setShowLocationPicker(false)}
                onSelect={setLocation}
                currentLocation={location}
            />
        </View>
    );
};
