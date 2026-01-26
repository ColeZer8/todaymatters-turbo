import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyBrief } from '../organisms/DailyBrief';
import { ScheduleList } from '../organisms/ScheduleList';
import { PendingActions } from '../organisms/PendingActions';
import { Big3ProgressCard } from '../organisms/Big3ProgressCard';
import { BottomToolbar } from '../organisms/BottomToolbar';
import { DemoMorningRoutine } from '../organisms/DemoMorningRoutine';
import { useDemoStore } from '@/stores';
import type { ScheduledEvent } from '@/stores';
import type { Big3ProgressData } from '../organisms/Big3ProgressCard';
// TODO: Re-enable ElevenLabs voice coach integration
// import { VoiceCoachButton } from '../organisms/VoiceCoachButton';

export interface HomeTemplateProps {
    dailyBrief: {
        name: string;
        date: string;
        unassignedCount: number;
        line1: string;
        line2: string;
        line3?: string;
    };
    schedule: {
        events: ScheduledEvent[];
        nowMinutes: number;
        onPressViewAll?: () => void;
    };
    pendingActions: {
        communicationsCount: number;
        communicationsDescription: string;
    };
    big3?: {
        data: Big3ProgressData;
        onSetBig3: (p1: string, p2: string, p3: string) => void;
    } | null;
    onPressGreeting?: () => void;
}

export const HomeTemplate = ({ dailyBrief, schedule, pendingActions, big3, onPressGreeting }: HomeTemplateProps) => {
    const insets = useSafeAreaInsets();
    
    // Demo mode - show morning routine when "Wake Up" time is selected
    const isDemoActive = useDemoStore((state) => state.isActive);
    const timeOfDay = useDemoStore((state) => state.timeOfDay);
    
    // Show devotional morning routine in demo mode
    if (isDemoActive && timeOfDay === 'devotional') {
        return <DemoMorningRoutine />;
    }

    return (
        <View
            className="flex-1 bg-[#F7FAFF]"
            style={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 72 }}
        >
            <View className="flex-1 px-6">
                <DailyBrief
                    name={dailyBrief.name}
                    date={dailyBrief.date}
                    unassignedCount={dailyBrief.unassignedCount}
                    line1={dailyBrief.line1}
                    line2={dailyBrief.line2}
                    line3={dailyBrief.line3}
                    onPressGreeting={onPressGreeting}
                />
                {big3 ? (
                    <Big3ProgressCard data={big3.data} onSetBig3={big3.onSetBig3} />
                ) : null}
                <ScheduleList events={schedule.events} nowMinutes={schedule.nowMinutes} onPressViewAll={schedule.onPressViewAll} />
                <PendingActions
                    communicationsCount={pendingActions.communicationsCount}
                    communicationsDescription={pendingActions.communicationsDescription}
                />
            </View>
            <BottomToolbar />
            {/* TODO: Re-enable ElevenLabs voice coach integration */}
            {/* <VoiceCoachButton 
                currentScreen="home"
                position="bottom-right"
            /> */}
        </View>
    );
};
