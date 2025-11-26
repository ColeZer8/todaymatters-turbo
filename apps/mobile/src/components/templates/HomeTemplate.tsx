
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyBrief } from '../organisms/DailyBrief';
import { ScheduleList } from '../organisms/ScheduleList';
import { PendingActions } from '../organisms/PendingActions';
import { BottomToolbar } from '../organisms/BottomToolbar';

export const HomeTemplate = () => {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.background, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }]}>
            <View style={styles.content}>
                <DailyBrief />
                <ScheduleList />
                <PendingActions />
            </View>
            <BottomToolbar />
        </View>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#F7FAFF',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
});
