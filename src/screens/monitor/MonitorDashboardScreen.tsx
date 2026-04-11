import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import { subscribeMonitoringPairs, subscribeHeartbeat } from '../../services/firestore';
import { computeStatus } from '../../utils/statusCompute';
import ContactCard from '../../components/ContactCard';
import type { MonitoringPairDocument, HeartbeatDocument } from '../../types/firestore';
import type { MonitorStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<MonitorStackParamList>;

export default function MonitorDashboardScreen() {
  const { currentUser } = useAuthStore();
  const navigation = useNavigation<Nav>();
  const [pairs, setPairs] = useState<Array<MonitoringPairDocument & { id: string }>>([]);
  const [heartbeats, setHeartbeats] = useState<Record<string, HeartbeatDocument | null>>({});
  const heartbeatUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!currentUser?.uid) return;

    const pairsUnsub = subscribeMonitoringPairs(currentUser.uid, (newPairs) => {
      setPairs(newPairs);
      newPairs.forEach((pair) => {
        if (!pair.monitoredId || heartbeatUnsubs.current[pair.monitoredId]) return;
        const hbUnsub = subscribeHeartbeat(pair.monitoredId, (hb) => {
          setHeartbeats((prev) => ({ ...prev, [pair.monitoredId]: hb }));
        });
        heartbeatUnsubs.current[pair.monitoredId] = hbUnsub;
      });
    });

    return () => {
      pairsUnsub();
      Object.values(heartbeatUnsubs.current).forEach((u) => u());
      heartbeatUnsubs.current = {};
    };
  }, [currentUser?.uid]);

  const visiblePairs = pairs.filter(
    (p) => p.status === 'active' || p.status === 'pending'
  );

  const safeCount = visiblePairs.filter((p) => {
    const hb = heartbeats[p.monitoredId];
    return hb ? computeStatus(hb.lastSeen, p.threshold_hours) === 'safe' : false;
  }).length;

  const needCheckCount = visiblePairs.length - safeCount;

  const hasDanger = visiblePairs.some((p) => {
    const hb = heartbeats[p.monitoredId];
    return !hb || computeStatus(hb.lastSeen, p.threshold_hours) === 'danger';
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>SafeSignal</Text>

      <View style={styles.summaryBar}>
        <View style={[styles.chip, styles.safeChip]}>
          <Text style={styles.chipText}>{safeCount} safe</Text>
        </View>
        {needCheckCount > 0 && (
          <View style={[styles.chip, styles.warnChip]}>
            <Text style={styles.chipText}>{needCheckCount} need checking</Text>
          </View>
        )}
      </View>

      {hasDanger && visiblePairs.length > 0 && (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerText}>
            ⚠️ One or more contacts may need attention
          </Text>
        </View>
      )}

      <FlatList
        data={visiblePairs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add someone to monitor</Text>
          </View>
        }
        renderItem={({ item }) => {
          const hb = heartbeats[item.monitoredId] ?? null;
          return (
            <ContactCard
              name={item.contactName ?? 'Pending'}
              emoji={item.contactEmoji ?? '👤'}
              relationship={item.contactRelationship ?? ''}
              lastSeen={hb?.lastSeen ?? null}
              thresholdHours={item.threshold_hours}
              onPress={() =>
                navigation.navigate('ContactDetail', {
                  pairId: item.id,
                  monitoredId: item.monitoredId,
                })
              }
            />
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddContactModal')}
        accessibilityLabel="Add contact"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  summaryBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  safeChip: { backgroundColor: '#E8F5E9' },
  warnChip: { backgroundColor: '#FFF3E0' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  dangerBanner: {
    backgroundColor: '#FFEBEE',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 10,
  },
  dangerText: { color: '#C62828', fontSize: 14, fontWeight: '500' },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },
});
