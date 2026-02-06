/**
 * CurrentTimeLine — red "NOW" line positioned between past and future events.
 */

import { View, Text, StyleSheet } from "react-native";

interface CurrentTimeLineProps {
  label?: string;
}

export const CurrentTimeLine = ({ label = "NOW" }: CurrentTimeLineProps) => (
  <View style={styles.container}>
    <View style={styles.dot} />
    <Text style={styles.label}>{label}</Text>
    <View style={styles.line} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#EF4444",
    marginLeft: 6,
    marginRight: 6,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: "#EF4444",
  },
});
