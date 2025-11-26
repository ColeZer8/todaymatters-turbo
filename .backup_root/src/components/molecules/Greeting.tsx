import { View } from 'react-native';
import { Typography } from '../atoms/Typography';

interface GreetingProps {
    name: string;
    date: string;
}

export const Greeting = ({ name, date }: GreetingProps) => {
    return (
        <View className="mb-4">
            <Typography variant="h1" className="text-text-primary leading-none">Good morning,</Typography>
            <Typography variant="h1" className="text-brand-primary leading-none" style={{ color: '#2563EB' }}>{name}.</Typography>
        </View>
    );
};
