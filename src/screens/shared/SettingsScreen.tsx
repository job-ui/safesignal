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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { signOut } from '../../services/auth';
import { subscribeMonitoringPairs, updateMonitoringPair } from '../../services/firestore';
import type { MonitoringPairDocument } from '../../types/firestore';
import type { MonitorStackParamList } from '../../navigation/types';
import { PlanTier } from '../../types/enums';

const THRESHOLD_OPTIONS = [4, 8, 12, 24, 48, 72];

const PLAN_LABELS: Record<PlanTier, string> = {
  [PlanTier.Free]: 'Free',
  [PlanTier.Family]: 'Family',
  [PlanTier.Pro]: 'Pro',
};

const PLAN_COLORS: Record<PlanTier, string> = {
  [PlanTier.Free]: '#9E9E9E',
  [PlanTier.Family]: '#4A90D9',
  [PlanTier.Pro]: '#7B1FA2',
};

type Nav = NativeStackNavigationProp<MonitorStackParamList>;

export default function SettingsScreen() {
  const { currentUser, clearUser } = useAuthStore();
  const { plan } = useSubscriptionStore();
  const navigation = useNavigation<Nav>();
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

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.planRow}>
            <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[plan] + '22' }]}>
              <Text style={[styles.planBadgeText, { color: PLAN_COLORS[plan] }]}>
                {PLAN_LABELS[plan]} Plan
              </Text>
            </View>
            {plan === PlanTier.Free && (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => navigation.navigate('SubscriptionPlans')}
              >
                <Text style={styles.upgradeBtnText}>Upgrade →</Text>
              </TouchableOpacity>
            )}
            {plan !== 'free' && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => navigation.navigate('SubscriptionPlans')}
              >
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            )}
          </View>
          {plan === PlanTier.Free && (
            <Text style={styles.planHint}>
              Monitor up to 2 people · 24h threshold · No auto-disclosure
            </Text>
          )}
          {plan === PlanTier.Family && (
            <Text style={styles.planHint}>
              Monitor up to 10 people · Custom thresholds · Auto-disclosure up to 6h
            </Text>
          )}
          {plan === PlanTier.Pro && (
            <Text style={styles.planHint}>
              Unlimited contacts · All thresholds · Auto-disclosure 2h–24h
            </Text>
          )}
        </View>

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

        {/* Privacy & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>
          <Text style={styles.sectionSubtitle}>What SafeSignal stores and when</Text>
          {[
            {
              icon: '💚',
              text: 'Heartbeat: a timestamp of when you last used the app, updated every 15 minutes while the app runs.',
            },
            {
              icon: '📍',
              text: 'Location: only recorded if you explicitly approve a request, or if you have separately opted in to auto-disclosure.',
            },
            {
              icon: '🗑️',
              text: 'Shared location data is deleted from SafeSignal servers 60 seconds after the monitor has received it.',
            },
            {
              icon: '🔒',
              text: 'Auto-disclosure is off by default and requires your explicit, separate consent before any location is ever stored.',
            },
          ].map((item, i) => (
            <View key={i} style={styles.privacyRow}>
              <Text style={styles.privacyIcon}>{item.icon}</Text>
              <Text style={styles.privacyText}>{item.text}</Text>
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
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  planBadgeText: { fontSize: 14, fontWeight: '700' },
  planHint: { fontSize: 12, color: '#888', lineHeight: 18 },
  upgradeBtn: {
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  manageBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDE3EE',
  },
  manageBtnText: { color: '#4A90D9', fontSize: 13, fontWeight: '600' },
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
  privacyRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  privacyIcon: { fontSize: 16, width: 20, textAlign: 'center' },
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
