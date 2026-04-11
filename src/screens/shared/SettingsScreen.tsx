import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { signOut } from '../../services/auth';
import { subscribeMonitoringPairs, updateMonitoringPair } from '../../services/firestore';
import type { MonitoringPairDocument } from '../../types/firestore';

const THRESHOLD_OPTIONS = [4, 8, 12, 24, 48, 72];

export default function SettingsScreen() {
  const { currentUser, clearUser } = useAuthStore();
  const [pairs, setPairs] = useState<Array<MonitoringPairDocument & { id: string }>>([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeMonitoringPairs(currentUser.uid, setPairs);
  }, [currentUser?.uid]);

  const activePairs = pairs.filter((p) => p.status === 'active');

  async function handleThresholdChange(pairId: string, hours: number) {
    try {
      await updateMonitoringPair(pairId, { threshold_hours: hours });
    } catch {
      Alert.alert('Error', 'Could not update inactivity threshold.');
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          clearUser();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Inactivity thresholds */}
        {activePairs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inactivity threshold</Text>
            <Text style={styles.sectionSubtitle}>
              Alert me if a contact hasn't been seen for…
            </Text>
            {activePairs.map((pair) => (
              <View key={pair.id} style={styles.pairBlock}>
                <Text style={styles.pairName}>
                  {pair.contactEmoji ?? '👤'} {pair.contactName ?? pair.monitoredId}
                </Text>
                <View style={styles.thresholdRow}>
                  {THRESHOLD_OPTIONS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.thresholdChip,
                        pair.threshold_hours === h && styles.thresholdChipActive,
                      ]}
                      onPress={() => handleThresholdChange(pair.id, h)}
                    >
                      <Text
                        style={[
                          styles.thresholdChipText,
                          pair.threshold_hours === h && styles.thresholdChipTextActive,
                        ]}
                      >
                        {h}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          {[
            'SafeSignal only monitors whether your contacts have used their phone recently — never their location.',
            'Location is only shared when a contact explicitly approves each individual request.',
            'Auto-disclosure only activates if your contact has separately opted in. It is off by default.',
            'Shared location data is deleted from SafeSignal servers 60 seconds after being viewed.',
          ].map((text, i) => (
            <View key={i} style={styles.privacyRow}>
              <Text style={styles.privacyBullet}>✓</Text>
              <Text style={styles.privacyText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.accountEmail}>{currentUser?.email ?? ''}</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', padding: 16 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#666', marginBottom: 14 },
  pairBlock: { marginBottom: 16 },
  pairName: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 8 },
  thresholdRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thresholdChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  thresholdChipActive: { backgroundColor: '#4A90D9' },
  thresholdChipText: { fontSize: 13, color: '#333' },
  thresholdChipTextActive: { color: '#fff', fontWeight: '600' },
  privacyRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  privacyBullet: { color: '#4CAF50', fontSize: 14, fontWeight: '700' },
  privacyText: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19 },
  accountEmail: { fontSize: 14, color: '#666', marginBottom: 14 },
  signOutBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#C62828', fontSize: 15, fontWeight: '600' },
});
