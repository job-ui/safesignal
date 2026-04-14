import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Timestamp } from 'firebase/firestore';
import { computeStatus, formatTimeAgo } from '../utils/statusCompute';

interface Props {
  name: string;
  emoji: string;
  relationship: string;
  lastSeen: Timestamp | null;
  thresholdHours: number;
  lastSeenBadgeTime?: Timestamp | null;
  awaitingJoin?: boolean;
  onPress: () => void;
}

const DOT_COLORS = {
  safe: '#4CAF50',
  warn: '#FF9800',
  danger: '#F44336',
} as const;

export default function ContactCard({
  name,
  emoji,
  relationship,
  lastSeen,
  thresholdHours,
  lastSeenBadgeTime,
  awaitingJoin = false,
  onPress,
}: Props) {
  const status = lastSeen ? computeStatus(lastSeen, thresholdHours) : 'danger';
  const timeAgo = lastSeen ? formatTimeAgo(lastSeen) : 'Never seen';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <Text style={styles.emoji}>{emoji || '👤'}</Text>
      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>
        {relationship ? <Text style={styles.relationship}>{relationship}</Text> : null}
        {awaitingJoin ? (
          <View style={styles.awaitingBadge}>
            <Text style={styles.awaitingText}>Waiting to join SafeSignal</Text>
          </View>
        ) : null}
        {!awaitingJoin && lastSeenBadgeTime ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              Last seen • {formatTimeAgo(lastSeenBadgeTime)}
            </Text>
          </View>
        ) : null}
      </View>
      {awaitingJoin ? (
        <View style={styles.right}>
          <View style={[styles.dot, { backgroundColor: '#BDBDBD' }]} />
          <Text style={styles.timeAgo}>Pending</Text>
        </View>
      ) : (
        <View style={styles.right}>
          <View style={[styles.dot, { backgroundColor: DOT_COLORS[status] }]} />
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emoji: { fontSize: 32, marginRight: 12 },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  relationship: { fontSize: 13, color: '#666', marginTop: 2 },
  badge: {
    marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12, color: '#E65100', fontWeight: '500' },
  awaitingBadge: {
    marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  awaitingText: { fontSize: 12, color: '#757575', fontWeight: '500' },
  right: { alignItems: 'center', gap: 4, minWidth: 64 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  timeAgo: { fontSize: 11, color: '#888', textAlign: 'center' },
});
