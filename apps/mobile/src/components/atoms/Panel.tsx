import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

interface PanelProps extends ViewProps {
  padded?: boolean;
}

export const Panel = ({ children, padded = true, style, ...props }: PropsWithChildren<PanelProps>) => {
  return (
    <View style={[styles.base, padded && styles.padded, style]} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E4E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
  },
  padded: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
});
