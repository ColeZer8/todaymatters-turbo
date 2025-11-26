import { View, Text, StyleSheet } from 'react-native';

interface GreetingProps {
    name: string;
    date: string;
}

export const Greeting = ({ name, date }: GreetingProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Good morning,</Text>
            <Text style={[styles.title, styles.name]}>{name}.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 4,
        marginBottom: 16,
    },
    title: {
        fontSize: 38,
        lineHeight: 42,
        fontWeight: '800',
        color: '#111827',
        // fontFamily: 'SF Pro Display', // Assuming system font handles this or it's set globally
    },
    name: {
        color: '#2563EB',
    },
});
