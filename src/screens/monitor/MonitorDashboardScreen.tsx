import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('initializing...');
  const heartbeatUnsubs = useRef<Record<string, () => void>>({});

  useEffect(() => {
    if (!currentUser?.uid) return;
    console.log('[Dashboard] currentUser.uid:', currentUser?.uid);
    setDebugInfo('uid: ' + currentUser?.uid?.substring(0, 8));

    const pairsUnsub = subscribeMonitoringPairs(currentUser.uid, (newPairs) => {
      setPairs(newPairs);
      setIsLoading(false);
      console.log('[Dashboard] pairs received:', newPairs.length, newPairs.map(p => ({id: p.id, monitoredId: p.monitoredId, status: p.status})));
      setDebugInfo('pairs: ' + newPairs.length + ' | monitored: ' + newPairs.map(p => p.monitoredId?.substring(0,6) ?? 'null').join(','));
      newPairs.forEach((pair) => {
        if (!pair.monitoredId) return;
        // Cancel existing subscription before resubscribing — prevents stale listeners on remount
        if (heartbeatUnsubs.current[pair.monitoredId]) {
          heartbeatUnsubs.current[pair.monitoredId]();
          delete heartbeatUnsubs.current[pair.monitoredId];
        }
        const hbUnsub = subscribeHeartbeat(pair.monitoredId, (hb) => {
          console.log('[Dashboard] heartbeat received for:', pair.monitoredId, 'hb:', hb);
          setDebugInfo(prev => prev + ' | hb:' + (hb ? hb.lastSeen?.toMillis() : 'null'));
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

  const joinedPairs = visiblePairs.filter((p) => !!p.monitoredId);

  const safeCount = joinedPairs.filter((p) => {
    const hb = heartbeats[p.monitoredId];
    return hb ? computeStatus(hb.lastSeen, p.threshold_hours) === 'safe' : false;
  }).length;

  const needCheckCount = joinedPairs.length - safeCount;

  const hasDanger = joinedPairs.some((p) => {
    const hb = heartbeats[p.monitoredId];
    return !hb || computeStatus(hb.lastSeen, p.threshold_hours) === 'danger';
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.getParent()?.navigate('RoleSelect' as never)}
          >
            <Text style={styles.switchRoleBtn}>← Switch role</Text>
          </TouchableOpacity>
          <Text style={styles.title}>SafeSignal</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4A90D9" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.getParent()?.getParent()?.navigate('RoleSelect' as never)}
        >
          <Text style={styles.switchRoleBtn}>← Switch role</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SafeSignal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={{fontSize: 10, color: '#999', paddingHorizontal: 16, paddingBottom: 4}}>
        {debugInfo}
      </Text>

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
          const awaitingJoin = !item.monitoredId;
          return (
            <ContactCard
              name={item.contactName ?? 'Pending'}
              emoji={item.contactEmoji ?? '👤'}
              relationship={item.contactRelationship ?? ''}
              lastSeen={hb?.lastSeen ?? null}
              thresholdHours={item.threshold_hours}
              awaitingJoin={awaitingJoin}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  switchRoleBtn: { fontSize: 14, color: '#4A90D9', fontWeight: '500', minWidth: 90 },
  headerSpacer: { minWidth: 90 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
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
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
