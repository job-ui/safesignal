# SafeSignal — Project Status

## Build
- **SDK:** Expo SDK 54
- **Build #27** submitted to TestFlight on April 22, 2026

## Features Implemented
- ✅ Firebase Auth (email + phone OTP)
- ✅ Firestore heartbeat (lastSeen timestamp)
- ✅ Monitor dashboard with real-time contact status
- ✅ Location request flow (approve / decline)
- ✅ Auto-disclosure toggle with consent dialog
- ✅ Push notifications (FCM)
- ✅ RevenueCat subscriptions (Free / Family / Pro)
- ✅ Invite flow (deep link via inviteHandler Cloud Function)
- ✅ Cloud Functions: inactivityChecker, locationCleanup, locationRequestTimeout, inviteHandler, heartbeatHTTP
- ✅ Life360-inspired background location heartbeat (CLVisit + significant location changes + continuous fallback)
- ✅ Native Swift location module (survives app termination)
- ✅ Adaptive continuous location (kicks in only after 2h silence)
- ✅ AppState watchdog
- ✅ Adjustable inactivity thresholds (6h/12h/24h/48h, Free locked to 12h)
- ✅ heartbeat source field (visit/significant/continuous/foreground)

## Known Issues
- [ ] Verify CLVisit and significant location changes firing on real devices
- [ ] Verify heartbeat stays alive overnight on Isabella's phone
- [ ] Verify Georg does NOT show active while sleeping
