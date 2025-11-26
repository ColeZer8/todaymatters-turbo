import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Typography } from '../atoms/Typography';
import { Icon } from '../atoms/Icon';

interface DateNavigatorProps {
    date: string;
    onPrevious?: () => void;
    onNext?: () => void;
}

export const DateNavigator = ({ date, onPrevious, onNext }: DateNavigatorProps) => {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-row items-center justify-between px-6" style={{ paddingTop: Math.max(insets.top - 20, 0), paddingBottom: 16 }}>
            <TouchableOpacity onPress={onPrevious} className="p-2">
                <Icon icon={ChevronLeft} size={24} color="#9CA3AF" />
            </TouchableOpacity>

            <Typography variant="h2" className="text-lg font-semibold">
                {date}
            </Typography>

            <TouchableOpacity onPress={onNext} className="p-2">
                <Icon icon={ChevronRight} size={24} color="#9CA3AF" />
            </TouchableOpacity>
        </View>
    );
};
