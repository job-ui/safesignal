import { GeoPoint, Timestamp } from 'firebase/firestore';
import { LocationType, RequestStatus, PlanTier } from './enums';

// 1. users/{uid}
export interface UserDocument {
  name: string;
  fcmToken: string | null;
  subscriptionTier: PlanTier;
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
  status: RequestStatus;
  requestedAt: Timestamp;
  respondedAt: Timestamp | null;
  location: GeoPoint | null;
  locationType: LocationType | null;
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
  plan: PlanTier;
  isActive: boolean;
  expiresAt: Timestamp | null;
  revenuecatId: string;
}
