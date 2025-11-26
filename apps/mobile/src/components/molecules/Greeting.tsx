import { View, Text } from 'react-native';

interface GreetingProps {
    name: string;
    date: string;
}

export const Greeting = ({ name, date }: GreetingProps) => {
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', lineHeight: 40, color: '#111827' }}>
                Good morning,
            </Text>
            <Text style={{ fontSize: 34, fontWeight: '800', lineHeight: 40, color: '#3B82F6' }}>
                {name}.
            </Text>
        </View>
    );
};
