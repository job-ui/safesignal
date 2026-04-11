import type { firestore } from 'firebase-admin';

type Timestamp = firestore.Timestamp;
type GeoPoint = firestore.GeoPoint;

// 1. users/{uid}
export interface UserDocument {
  name: string;
  fcmToken: string | null;
  subscriptionTier: 'free' | 'family' | 'pro';
  createdAt: Timestamp;
}

// 2. monitoring_pairs/{id}
export interface MonitoringPairDocument {
  monitorId: string;
  monitoredId: string;
  status: 'pending' | 'active' | 'paused' | 'revoked' | 'declined';
  threshold_hours: number;
  consentAt: Timestamp | null;
  autoDisclosureEnabled: boolean;
  autoDisclosureAfterH: number | null;
  monitoredConsentedAt: Timestamp | null;
  sentAlertAt?: Timestamp | null;
  contactName?: string;
  contactEmoji?: string;
  contactRelationship?: string;
}

// 3. heartbeats/{uid}
export interface HeartbeatDocument {
  lastSeen: Timestamp;
  appVersion: string;
}

// 4. location_requests/{id}
export interface LocationRequestDocument {
  fromUserId: string;
  toUserId: string;
  message: string;
  status: 'pending' | 'approved' | 'declined' | 'resolved' | 'auto_resolved';
  requestedAt: Timestamp;
  respondedAt: Timestamp | null;
  location: GeoPoint | null;
  locationType: 'live' | 'last_seen' | 'unavailable' | null;
  autoTriggerAfterH: number | null;
  autoTriggeredAt: Timestamp | null;
  lastKnownRecordedAt: Timestamp | null;
}

// 5. last_known_location/{uid}
export interface LastKnownLocationDocument {
  userId: string;
  location: GeoPoint;
  recordedAt: Timestamp;
  accuracy: number;
  consentedAt: Timestamp;
}

// 6. subscriptions/{uid}
export interface SubscriptionDocument {
  plan: 'free' | 'family' | 'pro';
  isActive: boolean;
  expiresAt: Timestamp | null;
  revenuecatId: string;
}
