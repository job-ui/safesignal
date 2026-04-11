import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function RoleSelectScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you using SafeSignal?</Text>
      <Text style={styles.subtitle}>Choose your role to continue</Text>

      <TouchableOpacity
        style={[styles.card, styles.monitorCard]}
        onPress={() => navigation.navigate('MonitorNav')}
      >
        <Text style={styles.cardEmoji}>👁️</Text>
        <Text style={styles.cardTitle}>I'm a Monitor</Text>
        <Text style={styles.cardDesc}>I want to check on family members' wellbeing</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, styles.monitoredCard]}
        onPress={() => navigation.navigate('MonitoredNav')}
      >
        <Text style={styles.cardEmoji}>📱</Text>
        <Text style={styles.cardTitle}>I'm being Monitored</Text>
        <Text style={styles.cardDesc}>A family member wants to check on me</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 40, textAlign: 'center' },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  monitorCard: { backgroundColor: '#e8f5e9' },
  monitoredCard: { backgroundColor: '#e3f2fd' },
  cardEmoji: { fontSize: 40, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4, color: '#1a1a2e' },
  cardDesc: { fontSize: 13, color: '#666', textAlign: 'center' },
});
