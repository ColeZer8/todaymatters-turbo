
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeHeader } from '../organisms/HomeHeader';
import { DailyBrief } from '../organisms/DailyBrief';
import { ScheduleList } from '../organisms/ScheduleList';
import { PendingActions } from '../organisms/PendingActions';
import { BottomToolbar } from '../organisms/BottomToolbar';

export const HomeTemplate = () => {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white">
            <View className="flex-1 px-6" style={{ paddingTop: insets.top }}>
                <HomeHeader />
                <DailyBrief />
                <ScheduleList />
                <PendingActions />
            </View>
            <BottomToolbar />
        </View>
    );
};
