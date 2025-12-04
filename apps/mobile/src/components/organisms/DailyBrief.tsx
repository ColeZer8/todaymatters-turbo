import { View, Text } from 'react-native';
import { Greeting } from '../molecules/Greeting';
import { useReviewTimeStore } from '@/stores';

export const DailyBrief = () => {
    const unassignedCount = useReviewTimeStore((state) => state.unassignedCount);

    return (
        <View>
            <Greeting name="Paul" date="Friday, Nov 8" unassignedCount={unassignedCount} />
            <View className="mt-3.5 mb-5">
                <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
                    This is the 13,653rd day of your life.
                </Text>
                <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
                    You have 32 minutes until your next event.
                </Text>
            </View>
        </View>
    );
};
