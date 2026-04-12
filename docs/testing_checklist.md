# SafeSignal — TestFlight Testing Checklist

Run through this checklist with at least two devices (one monitor, one monitored) before marking a build as ready.

---

## Setup

- [ ] Install build from TestFlight on both devices
- [ ] Create a monitor account on Device A
- [ ] Create a monitored account on Device B

---

## Authentication

- [ ] Sign up with email creates account in Firebase Auth console
- [ ] Sign in works with existing credentials
- [ ] Sign out clears session and returns to sign-in screen
- [ ] Signing back in restores the correct role/navigation

---

## Heartbeat

- [ ] After logging in, a `heartbeats/{uid}` document appears in Firestore within 15 minutes
- [ ] `lastSeen` timestamp on the heartbeat updates every ~15 minutes while app is in background
- [ ] Dashboard status dot shows green (safe) when heartbeat is recent

---

## Monitor Flow

- [ ] Monitor dashboard loads with loading spinner, then shows contact list (or empty state)
- [ ] Tapping + opens Add Contact modal
- [ ] Entering a name and tapping Send Invite generates a share sheet with a deep link
- [ ] Pending contact appears on dashboard
- [ ] Free plan blocks adding a 3rd contact — upgrade prompt shown
- [ ] Tapping a contact opens Contact Detail screen
- [ ] Contact Detail shows correct status colour and "Last seen X ago"

---

## Monitored Flow

- [ ] Monitored person receives invite link
- [ ] Tapping link opens MonitoredConsent screen showing [Monitor name]
- [ ] Permission list shows exactly what will be shared
- [ ] Auto-disclosure toggle is OFF by default, never pre-checked
- [ ] Tapping auto-disclosure toggle ON shows two-statement confirmation dialog:
  - (a) location stored on servers every 15 min
  - (b) only shared with [name] if no response within [X hours]
- [ ] Tapping Cancel on dialog leaves toggle OFF
- [ ] Confirming dialog sets toggle ON and writes `monitoredConsentedAt` to Firestore
- [ ] Tapping Approve writes `consentAt` and sets `status: 'active'`
- [ ] Tapping Decline sets `status: 'declined'`

---

## Location Requests

- [ ] Monitor sends a location request from Contact Detail → Request Location
- [ ] Monitored device receives push notification
- [ ] Location Request screen shows monitor's name and message
- [ ] **Approve:** device prompts for location permission (if not yet granted)
  - [ ] On approval: `location` GeoPoint written to Firestore, `locationType: 'live'`
  - [ ] Monitor dashboard updates in real time
- [ ] **Decline:** `status: 'declined'`, `respondedAt` written
- [ ] If location permission denied: banner shows "Your location services appear to be off. You can still decline this request."

---

## Auto-Disclosure (Family/Pro plan)

- [ ] Auto-disclosure countdown visible on Location Request screen when `autoTriggerAfterH > 0`
- [ ] Countdown updates every minute
- [ ] With a 1h timeout: after 1 hour without response, request auto-resolves
  - [ ] If `last_known_location` exists: `locationType: 'last_seen'`, location written
  - [ ] If no location: `locationType: 'unavailable'`, FCM sent to monitor
- [ ] Monitor receives push notification in both cases
- [ ] Contact Detail timeline shows "unavailable" note when locationType is unavailable

---

## Inactivity Alerts (requires Cloud Functions deployed)

- [ ] Set heartbeat's `lastSeen` to >24h ago manually in Firestore
- [ ] Within 15 minutes, monitor receives FCM: "[Name] has been inactive for X hours"
- [ ] Alert is not re-sent within threshold/2 hours

---

## Revoke & Consent Management

- [ ] Monitored person can pause monitoring (status → 'paused')
- [ ] Monitored person can revoke access (status → 'revoked')
- [ ] Revoking auto-disclosure deletes `last_known_location/{uid}` document immediately
- [ ] After revoke, `last_known_location` document is confirmed absent in Firestore

---

## Subscription Gates

- [ ] Free plan: attempting to add 3rd contact shows upgrade prompt with "Upgrade to Family" CTA
- [ ] Free plan: Contact Detail auto-disclosure section shows 🔒 locked state
- [ ] Free plan: Emergency Modal shows 🔒 instead of auto-timeout picker
- [ ] Subscription screen accessible from Settings → Upgrade button
- [ ] Subscription screen shows 3 plan cards: Free, Family, Pro
- [ ] "Most Popular" badge on Family plan
- [ ] Restore Purchases link works

---

## Offline Behaviour

- [ ] Turn off WiFi and mobile data
- [ ] Grey offline banner appears at top of screen: "You're offline — showing last known data"
- [ ] Banner disappears when connection is restored

---

## Push Notifications

- [ ] Notification permission requested on first launch
- [ ] Location request notification received on monitored device
- [ ] Inactivity alert received on monitor device (requires Cloud Functions)
- [ ] Tapping notification opens the correct screen

---

## Build Metadata

| Field | Value |
|-------|-------|
| Bundle ID | com.safesignal.app |
| EAS Project | 6b4dacb7-c7a5-42cd-b462-a6040a0f4999 |
| Heartbeat interval | 900s (15 min) |
| Region | europe-west1 |
