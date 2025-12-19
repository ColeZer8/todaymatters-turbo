import { View, Text } from 'react-native';
import { Greeting } from '../molecules/Greeting';

export interface DailyBriefProps {
    name: string;
    date: string;
    unassignedCount: number;
    line1: string;
    line2: string;
    line3?: string;
}

export const DailyBrief = ({ name, date, unassignedCount, line1, line2, line3 }: DailyBriefProps) => {
    return (
        <View>
            <Greeting name={name} date={date} unassignedCount={unassignedCount} />
            <View className="mt-3.5 mb-5">
                <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
                    {line1}
                </Text>
                <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
                    {line2}
                </Text>
                {line3 ? (
                    <Text className="text-[17.5px] leading-[29px] font-bold text-[#4A5568] max-w-[90%]">
                        {line3}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};
