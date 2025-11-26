import { View, TouchableOpacity } from 'react-native';
import { Typography } from '../atoms/Typography';

interface SectionHeaderProps {
    title: string;
    actionText?: string;
    onActionPress?: () => void;
}

export const SectionHeader = ({ title, actionText, onActionPress }: SectionHeaderProps) => {
    return (
        <View className="flex-row justify-between items-center mb-2 mt-4">
            <Typography variant="h2">{title}</Typography>
            {actionText && (
                <TouchableOpacity onPress={onActionPress}>
                    <Typography variant="link">{actionText}</Typography>
                </TouchableOpacity>
            )}
        </View>
    );
};
