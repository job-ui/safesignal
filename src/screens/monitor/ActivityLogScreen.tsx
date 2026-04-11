import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import {
  subscribeOutgoingLocationRequests,
  subscribeMonitoringPairs,
} from '../../services/firestore';
import { formatTimeAgoMs } from '../../utils/statusCompute';
import type { LocationRequestDocument, MonitoringPairDocument } from '../../types/firestore';
import { RequestStatus } from '../../types/enums';

interface LogEvent {
  id: string;
  icon: string;
  description: string;
  timestamp: number;
}

function requestIcon(status: string): string {
  if (status === RequestStatus.Approved || status === RequestStatus.Resolved) return '✅';
  if (status === RequestStatus.Declined) return '❌';
  if (status === RequestStatus.AutoResolved) return '🔄';
  return '📍';
}

function requestDescription(req: LocationRequestDocument): string {
  if (req.status === RequestStatus.AutoResolved) {
    return req.locationType === 'unavailable'
      ? 'Auto-disclosure triggered — no location available'
      : 'Location auto-disclosed';
  }
  if (req.status === RequestStatus.Approved) return 'Location request approved';
  if (req.status === RequestStatus.Declined) return 'Location request declined';
  return 'Location request sent';
}

export default function ActivityLogScreen() {
  const { currentUser } = useAuthStore();
  const [locationRequests, setLocationRequests] = useState<
    Array<LocationRequestDocument & { id: string }>
  >([]);
  const [pairs, setPairs] = useState<Array<MonitoringPairDocument & { id: string }>>([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeOutgoingLocationRequests(currentUser.uid, setLocationRequests);
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    return subscribeMonitoringPairs(currentUser.uid, setPairs);
  }, [currentUser?.uid]);

  const events: LogEvent[] = [
    ...pairs
      .filter((p) => p.consentAt != null)
      .map((p) => ({
        id: `pair-${p.id}`,
        icon: '🤝',
        description: `${p.contactName ?? 'Contact'} accepted monitoring`,
        timestamp: p.consentAt!.toMillis(),
      })),
    ...locationRequests.map((r) => ({
      id: `req-${r.id}`,
      icon: requestIcon(r.status),
      description: requestDescription(r),
      timestamp:
        r.respondedAt?.toMillis() ?? r.autoTriggeredAt?.toMillis() ?? r.requestedAt?.toMillis() ?? 0,
    })),
  ]
    .filter((e) => e.timestamp > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Activity Log</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No activity yet</Text>
            <Text style={styles.emptySubtext}>Events will appear here as contacts interact</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.body}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.time}>
                {new Date(item.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                · {formatTimeAgoMs(item.timestamp)}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', padding: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 16, color: '#888', marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBF0',
  },
  icon: { fontSize: 22, width: 32, textAlign: 'center' },
  body: { flex: 1 },
  description: { fontSize: 14, color: '#1A1A2E', fontWeight: '500' },
  time: { fontSize: 12, color: '#888', marginTop: 3 },
});
