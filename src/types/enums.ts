export enum LocationType {
  Live = 'live',
  LastSeen = 'last_seen',
  Unavailable = 'unavailable',
}

export enum RequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Declined = 'declined',
  Resolved = 'resolved',
  AutoResolved = 'auto_resolved',
}

export enum PlanTier {
  Free = 'free',
  Family = 'family',
  Pro = 'pro',
}

export enum UserRole {
  Monitor = 'monitor',
  Monitored = 'monitored',
}
