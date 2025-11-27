import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, Text } from 'react-native';

export const LogoBadge = () => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.halo} />
      <LinearGradient
        colors={['#4D8BFF', '#2563EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <Text style={styles.text}>TM</Text>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  text: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
