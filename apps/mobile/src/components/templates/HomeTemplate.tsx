
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader } from '../organisms/HomeHeader';
import { DailyBrief } from '../organisms/DailyBrief';
import { ScheduleList } from '../organisms/ScheduleList';
import { PendingActions } from '../organisms/PendingActions';

export const HomeTemplate = () => {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white" style={{ paddingTop: Math.max(insets.top - 45, 0) }}>
            <View className="flex-1 px-6">
                <HomeHeader />
                <DailyBrief />
                <ScheduleList />
                <PendingActions />
            </View>
        </View>
    );
};
