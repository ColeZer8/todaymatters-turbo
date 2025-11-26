import { View, TouchableOpacity, Text } from 'react-native';

interface SectionHeaderProps {
    title: string;
    actionText?: string;
    onActionPress?: () => void;
}

export const SectionHeader = ({ title, actionText, onActionPress }: SectionHeaderProps) => {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 32 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#4B5563', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                {title}
            </Text>
            {actionText && (
                <TouchableOpacity onPress={onActionPress}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#3B82F6' }}>
                        {actionText}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
