import { View } from 'react-native';
import { Greeting } from '../molecules/Greeting';
import { Typography } from '../atoms/Typography';

export const DailyBrief = () => {
    return (
        <View className="pb-4 mt-0">
            <Greeting name="Paul" date="Friday, Nov 8" />
            <View className="space-y-1">
                <Typography variant="body" className="text-lg text-gray-600 leading-7">
                    This is the 13,653rd day of your life.
                </Typography>
                <Typography variant="body" className="text-lg text-gray-600 leading-7">
                    You have 32 minutes until your next event.
                </Typography>
            </View>
        </View>
    );
};
