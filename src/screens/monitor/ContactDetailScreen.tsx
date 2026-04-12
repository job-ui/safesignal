import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MonitorStackParamList } from '../../navigation/types';
import {
  subscribeHeartbeat,
  subscribeOutgoingLocationRequests,
  subscribeMonitoringPairs,
  updateMonitoringPair,
} from '../../services/firestore';
import { computeStatus, formatTimeAgo } from '../../utils/statusCompute';
import type { HeartbeatDocument, LocationRequestDocument, MonitoringPairDocument } from '../../types/firestore';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { PlanTier } from '../../types/enums';

type Props = NativeStackScreenProps<MonitorStackParamList, 'ContactDetail'>;
type Nav = NativeStackNavigationProp<MonitorStackParamList>;

const AUTO_DISCLOSE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '2h', value: 2 },
  { label: '4h', value: 4 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
];

const STATUS_LABELS = { safe: 'Safe', warn: 'Check in', danger: 'Needs attention' } as const;
const STATUS_COLORS = { safe: '#4CAF50', warn: '#FF9800', danger: '#F44336' } as const;

const REQUEST_ICONS: Record<string, string> = {
  pending: '⏳',
  approved: '✅',
  declined: '❌',
  resolved: '✅',
  auto_resolved: '🔄',
};

export default function ContactDetailScreen({ route }: Props) {
  const { pairId, monitoredId } = route.params;
  const { currentUser } = useAuthStore();
  const { plan } = useSubscriptionStore();
  const navigation = useNavigation<Nav>();

  const [pair, setPair] = useState<(MonitoringPairDocument & { id: string }) | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatDocument | null>(null);
  const [locationRequests, setLocationRequests] = useState<
    Array<LocationRequestDocument & { id: string }>
  >([]);
  const [loadingPair, setLoadingPair] = useState(true);
  const [savingAutoDisclose, setSavingAutoDisclose] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeMonitoringPairs(currentUser.uid, (pairs) => {
      const found = pairs.find((p) => p.id === pairId) ?? null;
      setPair(found);
      setLoadingPair(false);
    });
  }, [currentUser?.uid, pairId]);

  useEffect(() => {
    if (!monitoredId) return;
    return subscribeHeartbeat(monitoredId, setHeartbeat);
  }, [monitoredId]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeOutgoingLocationRequests(currentUser.uid, (reqs) => {
      setLocationRequests(reqs.filter((r) => r.toUserId === monitoredId));
    });
  }, [currentUser?.uid, monitoredId]);

  const status = heartbeat
    ? computeStatus(heartbeat.lastSeen, pair?.threshold_hours ?? 24)
    : 'danger';
  const timeAgo = heartbeat ? formatTimeAgo(heartbeat.lastSeen) : 'Never';
  const contactName = pair?.contactName ?? 'Contact';
  const contactEmoji = pair?.contactEmoji ?? '👤';
  const currentAutoH = pair?.autoDisclosureAfterH ?? 0;
  const monitoredHasConsented = pair?.monitoredConsentedAt != null;
  const isFreePlan = plan === PlanTier.Free;

  const sevenDaysAgo = Date.now() - 7 * 24 * 3_600_000;
  const recentRequests = locationRequests.filter(
    (r) => (r.requestedAt?.toMillis() ?? 0) > sevenDaysAgo
  );

  async function handleAutoDisclosureChange(hours: number) {
    setSavingAutoDisclose(true);
    try {
      await updateMonitoringPair(pairId, {
        autoDisclosureEnabled: hours > 0,
        autoDisclosureAfterH: hours > 0 ? hours : null,
      });
    } catch {
      Alert.alert('Error', 'Could not update auto-disclosure setting.');
    } finally {
      setSavingAutoDisclose(false);
    }
  }

  if (loadingPair) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.avatar}>{contactEmoji}</Text>
          <Text style={styles.name}>{contactName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
            <Text style={[styles.statusLabel, { color: STATUS_COLORS[status] }]}>
              {STATUS_LABELS[status]}
            </Text>
          </View>
          <Text style={styles.lastSeen}>Last seen {timeAgo}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('EmergencyModal', { pairId, monitoredId, contactName })
            }
          >
            <Text style={styles.actionBtnText}>📍 Request Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.emergencyBtn]}
            onPress={() =>
              navigation.navigate('EmergencyModal', { pairId, monitoredId, contactName })
            }
          >
            <Text style={[styles.actionBtnText, styles.emergencyBtnText]}>
              🚨 Emergency Request
            </Text>
          </TouchableOpacity>
        </View>

        {/* Auto-disclosure */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Auto-disclose after</Text>

          {isFreePlan ? (
            <View style={styles.lockedBlock}>
              <Text style={styles.lockedIcon}>🔒</Text>
              <Text style={styles.lockedText}>
                Auto-disclosure is a Family plan feature.
              </Text>
              <TouchableOpacity
                style={styles.upgradeLink}
                onPress={() => navigation.navigate('SubscriptionPlans')}
              >
                <Text style={styles.upgradeLinkText}>Upgrade to Family →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionSubtitle}>
                {monitoredHasConsented
                  ? `${contactName} has enabled auto-disclosure`
                  : `${contactName} has not yet enabled auto-disclosure`}
              </Text>
              <View style={styles.optionRow}>
                {AUTO_DISCLOSE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionChip,
                      currentAutoH === opt.value && styles.optionChipActive,
                    ]}
                    onPress={() => handleAutoDisclosureChange(opt.value)}
                    disabled={savingAutoDisclose}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        currentAutoH === opt.value && styles.optionChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* 7-day timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last 7 days</Text>
          {recentRequests.length === 0 ? (
            <Text style={styles.emptyTimeline}>No location requests in the last 7 days</Text>
          ) : (
            recentRequests.map((req) => (
              <View key={req.id} style={styles.timelineItem}>
                <Text style={styles.timelineIcon}>
                  {REQUEST_ICONS[req.status] ?? '📍'}
                </Text>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineText}>
                    Location request — {req.status.replace('_', ' ')}
                  </Text>
                  {req.locationType === 'unavailable' && (
                    <Text style={styles.unavailableText}>
                      Auto-disclosure triggered but no location was available on {contactName}'s phone.
                    </Text>
                  )}
                  <Text style={styles.timelineTime}>
                    {req.requestedAt ? formatTimeAgo(req.requestedAt) : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backText: { color: '#4A90D9', fontSize: 16 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 20 },
  avatar: { fontSize: 64, marginBottom: 8 },
  name: { fontSize: 24, fontWeight: '700', color: '#1A1A2E', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 14, fontWeight: '600' },
  lastSeen: { fontSize: 14, color: '#666' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE3EE',
  },
  emergencyBtn: { borderColor: '#FFCDD2' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#4A90D9' },
  emergencyBtnText: { color: '#C62828' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#666', marginBottom: 12 },
  lockedBlock: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  lockedIcon: { fontSize: 24 },
  lockedText: { fontSize: 14, color: '#888', textAlign: 'center' },
  upgradeLink: { marginTop: 4 },
  upgradeLinkText: { fontSize: 14, color: '#4A90D9', fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  optionChipActive: { backgroundColor: '#4A90D9' },
  optionChipText: { fontSize: 14, color: '#333', fontWeight: '500' },
  optionChipTextActive: { color: '#fff' },
  emptyTimeline: { fontSize: 14, color: '#888', textAlign: 'center', paddingVertical: 12 },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timelineIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  timelineBody: { flex: 1 },
  timelineText: { fontSize: 14, color: '#333' },
  unavailableText: { fontSize: 12, color: '#E65100', marginTop: 2, lineHeight: 16 },
  timelineTime: { fontSize: 12, color: '#888', marginTop: 2 },
});
