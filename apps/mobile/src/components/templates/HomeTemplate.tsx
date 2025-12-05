import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyBrief } from '../organisms/DailyBrief';
import { ScheduleList } from '../organisms/ScheduleList';
import { PendingActions } from '../organisms/PendingActions';
import { BottomToolbar } from '../organisms/BottomToolbar';
import { VoiceCoachButton } from '../organisms/VoiceCoachButton';

export const HomeTemplate = () => {
    const insets = useSafeAreaInsets();

    return (
        <View
            className="flex-1 bg-[#F7FAFF]"
            style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
        >
            <View className="flex-1 px-6">
                <DailyBrief />
                <ScheduleList />
                <PendingActions />
            </View>
            <BottomToolbar />
            <VoiceCoachButton 
                currentScreen="home"
                position="bottom-right"
            />
        </View>
    );
};
