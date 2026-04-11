import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ActivityLogScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Activity Log</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  text: { fontSize: 18, color: '#666' },
});
