import { View, Text } from 'react-native';
import { Greeting } from '../molecules/Greeting';

export const DailyBrief = () => {
    return (
        <View style={{ paddingBottom: 4 }}>
            <Greeting name="Paul" date="Friday, Nov 8" />
            <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: '400', lineHeight: 24, color: '#6B7280' }}>
                    This is the 13,653rd day of your life.
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '400', lineHeight: 24, color: '#6B7280' }}>
                    You have 32 minutes until your next event.
                </Text>
            </View>
        </View>
    );
};
