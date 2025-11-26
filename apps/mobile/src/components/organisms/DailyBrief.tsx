import { View, StyleSheet, Text } from 'react-native';
import { Greeting } from '../molecules/Greeting';

export const DailyBrief = () => {
    return (
        <View>
            <Greeting name="Paul" date="Friday, Nov 8" />
            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>
                    This is the 13,653rd day of your life.
                </Text>
                <Text style={styles.subtitle}>
                    You have 32 minutes until your next event.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    subtitleContainer: {
        marginTop: 14,
        marginBottom: 22,
    },
    subtitle: {
        fontSize: 17.5,
        lineHeight: 29,
        fontWeight: '700',
        color: '#4A5568',
        maxWidth: '90%',
    },
});
