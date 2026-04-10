# SafeSignal — Claude Code Prompt Package
### Master Context + Phase Prompts (v1.1)
---

## HOW TO USE THIS DOCUMENT

This file contains everything you need to build SafeSignal with Claude Code, phase by phase.

- **Before each phase**, read the "Before You Start" checklist for that phase. It tells you what to do manually first.
- **To start each phase**, open Claude Code in your Safesignal folder and paste the prompt exactly as written.
- **The CLAUDE.md section** (below) must be created once before Phase 0. It is the permanent memory file that keeps Claude Code oriented across all sessions.

---

## STEP 0 — CREATE YOUR CLAUDE.md FILE FIRST

Before running any phase prompt, create a file called `CLAUDE.md` in your `C:\Users\Jón Óttar\OneDrive\Claude\Safesignal` folder. This file acts as Claude Code's persistent memory — it reads this file automatically at the start of every session.

**Create a new text file called `CLAUDE.md` and paste this content into it:**

---

```markdown
# SafeSignal — Project Memory File

## What This Project Is
SafeSignal is a privacy-first family wellness iOS app built with React Native (Expo SDK 52) and Firebase.
It monitors whether a person has used their phone recently — NOT their location.
Location is only ever shared with explicit consent, or automatically after a configurable timeout if the user pre-consented.

## Core Privacy Rule (Non-Negotiable)
- Normal operation: heartbeat only (lastSeen timestamp). Zero location data.
- Location requests: require explicit approval by the monitored person.
- Auto-disclosure: only activates if the monitored person has separately opted in. Off by default.
- The `last_known_location` collection must NEVER be written to unless `prefs.shareLastKnownLocation === true`.

## Tech Stack
- Mobile: React Native + Expo SDK 52, TypeScript strict mode
- Navigation: React Navigation v6 (Stack + Bottom Tabs)
- Auth: Firebase Auth v10 modular SDK (Email + Phone OTP)
- Database: Firestore (6 collections — see below)
- Push: FCM + expo-notifications
- Background: expo-background-fetch + expo-task-manager
- Location: expo-location (getLastKnownPositionAsync ONLY — no always-on permission)
- Cloud Functions: Firebase Functions Node 20, TypeScript
- Payments: RevenueCat react-native-purchases v7
- State: Zustand v4
- Build: EAS Build + Submit

## The Six Firestore Collections
1. `users/{uid}` — name, fcmToken, subscriptionTier, createdAt
2. `monitoring_pairs/{id}` — monitorId, monitoredId, status, threshold_hours, consentAt, autoDisclosureEnabled, autoDisclosureAfterH, monitoredConsentedAt
3. `heartbeats/{uid}` — lastSeen (serverTimestamp), appVersion (single doc per user, overwritten every 15 min)
4. `location_requests/{id}` — fromUserId, toUserId, message, status (pending|approved|declined|resolved|auto_resolved), requestedAt, respondedAt, location (ephemeral GeoPoint|null), locationType (live|last_seen|unavailable|null), autoTriggerAfterH, autoTriggeredAt, lastKnownRecordedAt
5. `last_known_location/{uid}` — userId, location (GeoPoint), recordedAt (serverTimestamp), accuracy (metres), consentedAt
6. `subscriptions/{uid}` — plan, isActive, expiresAt, revenuecatId (written by RevenueCat webhook)

## The Four Cloud Functions
1. `inactivityChecker` — scheduled every 15 min, scans heartbeats vs threshold_hours, sends FCM alert
2. `locationCleanup` — onDocumentUpdated trigger, deletes location field 60s after status="resolved"
3. `locationRequestTimeout` — scheduled every 30 min, auto-resolves pending requests past autoTriggerAfterH, sends FCM to monitor
4. `inviteHandler` — HTTP function, generates deep link, creates pending monitoring_pairs doc

## The 11 Screens
1. Splash — role selection (Monitor / Monitored)
2. MonitorDashboard — real-time contact cards with status
3. ContactDetail — heartbeat history, action buttons, auto-disclosure settings
4. ActivityLog — chronological event timeline
5. Settings — threshold picker, toggles
6. SubscriptionPlans — 3 plan cards via RevenueCat
7. MonitoredConsent — permission list + auto-disclosure opt-in
8. MonitoredActive — heartbeat ring, monitors list, pause/revoke
9. LocationRequest — approve/decline with auto-countdown timer
10. AddContact (modal) — name, relationship, emoji, invite link
11. Emergency (modal) — message textarea, timeout picker, send

## Subscription Tiers
- Free: max 2 monitored contacts, 24h threshold, no auto-disclosure
- Family ($3.99/mo): 10 people, custom thresholds, location history, auto-disclosure up to 6h
- Pro ($7.99/mo): unlimited people, auto-disclosure 2h–24h configurable

## File Structure
```
safesignal/
├── app.json
├── App.tsx
├── CLAUDE.md
├── src/
│   ├── screens/
│   ├── components/        # ContactCard, StatusDot, HeartbeatRing, AutoDisclosureToggle, CountdownTimer
│   ├── navigation/
│   ├── services/
│   │   ├── firestore.ts   # Typed CRUD for all 6 collections
│   │   ├── auth.ts
│   │   ├── notifications.ts
│   │   └── location.ts    # getLastKnownPositionAsync wrapper
│   ├── stores/            # Zustand stores
│   ├── types/
│   │   ├── firestore.ts   # Document interfaces
│   │   └── enums.ts       # LocationType, RequestStatus, PlanTier
│   ├── utils/
│   └── constants/
├── functions/
│   ├── src/
│   │   ├── inactivityChecker.ts
│   │   ├── locationCleanup.ts
│   │   ├── locationRequestTimeout.ts
│   │   ├── inviteHandler.ts
│   │   └── index.ts
│   └── package.json
├── firestore.rules
├── docs/
│   └── SafeSignal_Project_Brief_v1.1.docx
└── prototype/
    └── index.html
```

## Consent Rules (Non-Negotiable UI Behaviour)
- Auto-disclosure toggle must be OFF by default, never pre-checked
- Toggle label: "Auto-share my location if I don't respond to a request"
- Tapping ON must show confirmation dialog stating: (a) location stored on servers every 15 min, (b) only shared with [monitor name] if no response within [X hours]
- consentedAt must be written to Firestore at moment of confirmation
- Revoking consent must immediately DELETE last_known_location/{uid}

## Progress Tracking
Update this section as phases complete:
- [ ] Phase 0 — Environment setup
- [ ] Phase 1 — Auth + Navigation shell
- [ ] Phase 2 — Monitor flow
- [ ] Phase 3 — Monitored flow
- [ ] Phase 4 — Cloud Functions
- [ ] Phase 5 — Subscriptions + Polish
- [ ] Phase 6 — TestFlight
```

---

## PHASE 0 — ENVIRONMENT SETUP

### Before You Start Phase 0

Do these steps manually before pasting the prompt:

1. **Install Node.js 20** — download from nodejs.org, choose "LTS" version. When done, open a terminal and type `node --version` — it should show v20.x.x.
2. **Install Git** — download from git-scm.com if you don't have it. Type `git --version` in a terminal to check.
3. **Have your Google account ready** — you'll need it to create a Firebase project at console.firebase.google.com.
4. **Have an Apple ID ready** — you'll need it for EAS later, but not yet.
5. **Open Claude Code** in your `C:\Users\Jón Óttar\OneDrive\Claude\Safesignal` folder.

---

### Phase 0 Prompt — Paste This Into Claude Code

```
You are setting up the SafeSignal React Native project. Read CLAUDE.md first for full project context.

This folder already contains:
- index.html (the UI prototype — move this to prototype/index.html)
- SafeSignal_Project_Brief_v1.1.docx (move this to docs/)
- CLAUDE.md (keep at root)

Your tasks for Phase 0:

1. Move existing files into the correct folders:
   - Create folder: prototype/
   - Move index.html → prototype/index.html
   - Create folder: docs/
   - Move SafeSignal_Project_Brief_v1.1.docx → docs/SafeSignal_Project_Brief_v1.1.docx

2. Initialise a new Expo project in the CURRENT directory (not a subdirectory):
   - Use: npx create-expo-app . --template expo-template-blank-typescript
   - When prompted about existing files, choose to keep them

3. Install all required packages in one command:
   npx expo install firebase @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack react-native-screens react-native-safe-area-context expo-notifications expo-background-fetch expo-task-manager expo-location zustand react-native-purchases

4. Install Firebase CLI and EAS CLI globally:
   npm install -g firebase-tools eas-cli

5. Update app.json with the following:
   - name: "SafeSignal"
   - slug: "safesignal"
   - bundleIdentifier: "com.safesignal.app"
   - Add expo-notifications plugin entry
   - Add BGTaskSchedulerPermittedIdentifiers: ["com.safesignal.heartbeat"]
   - Add NSLocationWhenInUseUsageDescription: "SafeSignal reads your cached location to share with your emergency contacts if you don't respond to a request."
   - Add NSUserNotificationsUsageDescription: "SafeSignal sends you alerts when your contacts are inactive or request your location."

6. Create the full folder structure under src/ as defined in CLAUDE.md

7. Create src/constants/tasks.ts with:
   export const HEARTBEAT_TASK = 'com.safesignal.heartbeat';

8. Create src/types/enums.ts with TypeScript enums for:
   - LocationType: 'live' | 'last_seen' | 'unavailable'
   - RequestStatus: 'pending' | 'approved' | 'declined' | 'resolved' | 'auto_resolved'
   - PlanTier: 'free' | 'family' | 'pro'
   - UserRole: 'monitor' | 'monitored'

9. Create src/types/firestore.ts with TypeScript interfaces exactly matching all 6 Firestore collection schemas from CLAUDE.md. Include GeoPoint type from firebase/firestore.

10. Create a placeholder App.tsx that renders a single text element: "SafeSignal — setup complete"

11. Initialise Git and make a first commit with message: "Phase 0 — project scaffolding complete"

After completing all tasks, tell me:
- Which tasks succeeded
- Which tasks need manual action from me (e.g. firebase login requires a browser)
- What the next manual step is

Do NOT proceed to any Phase 1 work. Stop cleanly after Phase 0.
```

---

### After Phase 0 — What You Do Manually

Once Claude Code finishes Phase 0, do these steps yourself:

1. **Create your Firebase project** — go to console.firebase.google.com, click "Add project", name it "safesignal". Enable Google Analytics if asked (optional).
2. **Enable Firebase services** inside the project:
   - Authentication → Sign-in method → enable Email/Password and Phone
   - Firestore Database → Create database → choose Production mode → pick a region close to you (e.g. europe-west1)
   - Cloud Messaging — this is enabled by default
3. **Get your Firebase config** — in Firebase Console, go to Project Settings → Your apps → Add app → Web app. Copy the config object (it looks like `{ apiKey: "...", authDomain: "...", ... }`). You'll paste this into Claude Code in Phase 1.
4. Mark Phase 0 complete in CLAUDE.md.

---

## PHASE 1 — AUTH + NAVIGATION SHELL

### Before You Start Phase 1

1. Firebase project created ✓
2. You have your Firebase web config object copied ✓
3. Phase 0 complete and committed in Git ✓

---

### Phase 1 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phase 0 is complete.

Phase 1 goal: Working auth screens, navigation shell, and heartbeat background task registering in Firestore.

I will now give you the Firebase config. Store it in a new file: src/constants/firebaseConfig.ts
Do NOT commit this file to Git — add it to .gitignore immediately.

[PASTE YOUR FIREBASE CONFIG HERE — replace this line with your actual config object]

Your tasks for Phase 1:

1. Create .gitignore if not present. Add: src/constants/firebaseConfig.ts, node_modules/, .env

2. Create src/services/auth.ts:
   - initializeApp using firebaseConfig
   - getAuth, getFirestore, getMessaging exports
   - signUpWithEmail(email, password, displayName)
   - signInWithEmail(email, password)
   - signOut
   - onAuthStateChanged listener export

3. Create src/stores/authStore.ts (Zustand):
   - State: currentUser (Firebase User | null), isLoading
   - Actions: setUser, clearUser
   - Persist session using expo-secure-store or AsyncStorage

4. Create src/navigation/RootNavigator.tsx:
   - If not authenticated → show AuthStack (SignIn, SignUp screens)
   - If authenticated → show RoleSelectScreen
   - RoleSelectScreen → navigates to MonitorNav or MonitoredNav based on user choice
   - MonitorNav: bottom tabs for Dashboard, ActivityLog, Settings
   - MonitoredNav: bottom tabs for MonitoredActive, Settings
   - All non-existent screens should be placeholder components that just show the screen name

5. Create src/screens/auth/SignInScreen.tsx:
   - Email + password inputs
   - Sign In button
   - Link to Sign Up
   - Error display

6. Create src/screens/auth/SignUpScreen.tsx:
   - Display name, email, password inputs
   - Sign Up button
   - On success: write user doc to users/{uid} in Firestore
   - Error display

7. Create src/tasks/heartbeat.ts:
   - Define HEARTBEAT_TASK using TaskManager.defineTask
   - On each run: write { lastSeen: serverTimestamp(), appVersion: from Constants } to heartbeats/{uid}
   - If prefs.shareLastKnownLocation is true AND prefs.lastKnownLocationConsentedAt exists:
     call Location.getLastKnownPositionAsync({ maxAge: 3600000, requiredAccuracy: 500 })
     If position returned: write to last_known_location/{uid} with location, recordedAt, accuracy, consentedAt
     If null: skip silently
   - Return BackgroundFetch.BackgroundFetchResult.NewData on success, Failed on error

8. In App.tsx:
   - Register HEARTBEAT_TASK with BackgroundFetch.registerTaskAsync (minimumInterval: 60 for testing — we'll change to 900 before TestFlight)
   - Request notification permissions via expo-notifications
   - Get FCM token and write it to users/{uid}.fcmToken
   - Render RootNavigator inside NavigationContainer

9. Create src/services/notifications.ts:
   - getFCMToken(): gets Expo push token + native FCM token
   - registerForPushNotifications(): requests permission, returns token
   - setNotificationHandler for foreground notifications

10. Run the app to confirm: expo start
    Tell me what the Expo QR code URL is and whether any errors appeared in the terminal.

11. Commit with message: "Phase 1 — auth, navigation shell, heartbeat task"

After completing, confirm:
- Sign up creates a user in Firebase Auth console
- Heartbeat document appears in Firestore under heartbeats/{uid} within ~1 minute
- Navigation moves correctly between auth and main screens

Do NOT start Phase 2 work. Stop here.
```

---

### After Phase 1 — What You Do Manually

1. Test on your phone using the Expo Go app (download from App Store).
2. Check Firebase Console → Firestore → see if heartbeats collection appears.
3. Create a second test account so you have two users to test monitor/monitored flows.
4. Mark Phase 1 complete in CLAUDE.md.

---

## PHASE 2 — MONITOR FLOW

### Before You Start Phase 2

1. Phase 1 complete and committed ✓
2. Heartbeat confirmed working in Firestore ✓
3. You have at least two test accounts ✓

---

### Phase 2 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phases 0 and 1 are complete.

Phase 2 goal: The full monitor-side experience. A monitor can add contacts, view real-time status, and send location requests with auto-timeout settings.

Your tasks for Phase 2:

1. Create src/services/firestore.ts with fully typed CRUD for all 6 collections:
   - Use TypeScript interfaces from src/types/firestore.ts
   - Functions needed:
     getMonitoringPairs(monitorId) → real-time listener
     getHeartbeat(userId) → real-time listener
     getLocationRequests(toUserId) → real-time listener
     createMonitoringPair(data) → write
     createLocationRequest(data) → write
     updateLocationRequest(reqId, data) → write
     getUserProfile(uid) → one-time read
     updateUserPreferences(uid, prefs) → write

2. Create src/utils/statusCompute.ts:
   - computeStatus(lastSeen: Timestamp, thresholdHours: number): 'safe' | 'warn' | 'danger'
   - safe: lastSeen within threshold
   - warn: exceeded threshold by less than 50%
   - danger: exceeded threshold by 50% or more
   - Include formatTimeAgo(timestamp): string — e.g. "2h ago", "3 days ago"

3. Build MonitorDashboardScreen (src/screens/monitor/MonitorDashboardScreen.tsx):
   - Real-time listener on monitoring_pairs where monitorId == currentUser.uid
   - For each pair, cross-join with heartbeats to get lastSeen
   - Render ContactCard component for each contact (see below)
   - Summary bar at top: X safe, X need checking
   - Alert banner if any contact is in 'danger' state
   - FAB button → opens AddContactModal

4. Build ContactCard component (src/components/ContactCard.tsx):
   - Shows: display name, relationship emoji, status dot (green/amber/red), time since last seen
   - Tappable → navigates to ContactDetailScreen
   - If locationType == 'last_seen' on any resolved request: show amber badge "Last seen • Xh ago"

5. Build ContactDetailScreen (src/screens/monitor/ContactDetailScreen.tsx):
   - Avatar, status badge, action buttons: "Request Location", "Emergency Request"
   - 7-day activity timeline showing heartbeat history
   - Auto-disclosure settings block:
     - Dropdown: "Auto-disclose after: [Off / 2h / 4h / 6h / 12h]"
     - Writes autoDisclosureEnabled and autoDisclosureAfterH to monitoring_pairs
     - Show consent status: "Contact has [not yet] enabled auto-disclosure"

6. Build ActivityLogScreen (src/screens/monitor/ActivityLogScreen.tsx):
   - Ordered list of events from monitoring_pairs + location_requests
   - Each event shows: type icon, description, timestamp
   - Real-time listener

7. Build AddContactModal (src/screens/monitor/AddContactModal.tsx):
   - Inputs: display name, relationship (picker), emoji (picker)
   - Invite method: share link (generates deep link placeholder — full deep link in Phase 4)
   - On submit: write monitoring_pairs doc with status: 'pending'

8. Build EmergencyModal (src/screens/monitor/EmergencyModal.tsx):
   - Textarea for message
   - Timeout picker: "Auto-share last location if no response after: [Never / 2h / 4h / 6h / 12h]"
   - Send button: writes location_requests doc with autoTriggerAfterH set
   - locationType defaults to null until resolved

9. Build SettingsScreen (src/screens/shared/SettingsScreen.tsx):
   - Inactivity threshold picker (hours): 4, 8, 12, 24, 48, 72
   - Writes to monitoring_pairs threshold_hours
   - Privacy explainer section
   - Sign out button

10. Commit with message: "Phase 2 — monitor flow complete"

Acceptance criteria — confirm each before committing:
- Monitor can see contact list with real-time status colours
- Tapping a contact opens detail screen
- Emergency modal writes a location_requests document to Firestore with autoTriggerAfterH set
- Auto-disclosure dropdown in ContactDetail writes to monitoring_pairs

Do NOT start Phase 3 work. Stop here.
```

---

### After Phase 2 — What You Do Manually

1. Test the full monitor flow on your phone.
2. Verify in Firestore Console that monitoring_pairs and location_requests documents are being written correctly.
3. Mark Phase 2 complete in CLAUDE.md.

---

## PHASE 3 — MONITORED FLOW

### Before You Start Phase 3

1. Phase 2 complete and committed ✓
2. You have tested the monitor flow works ✓
3. You have a second test device or the Expo Go app on a second phone (or use a simulator) ✓

---

### Phase 3 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phases 0–2 are complete.

Phase 3 goal: The full monitored-person experience. The monitored person can consent to monitoring, view and approve/decline location requests, manage auto-disclosure consent, and revoke access.

Your tasks for Phase 3:

1. Build MonitoredConsentScreen (src/screens/monitored/MonitoredConsentScreen.tsx):
   Shown when a new monitoring_pairs doc with status='pending' exists for this user.
   - Header: "[Monitor name] wants to monitor your wellbeing"
   - Permission list showing exactly what will be shared:
     ✓ "Whether you've used your phone recently"
     ✓ "Your location — only if you approve each request"
     ○ "📍 Last known location (if you don't respond) — only if you agree below"
   - Auto-disclosure opt-in section (SEPARATE from base consent):
     - Toggle: OFF by default, never pre-checked
     - Label: "Auto-share my location if I don't respond to a request"
     - Shows: "Auto-share window: [X hours] — set by [monitor name]"
     - Tapping ON triggers confirmation dialog with BOTH required statements:
       (a) "This stores your approximate location on SafeSignal's servers, updated every 15 minutes while the app is running."
       (b) "Your location will only ever be shared with [monitor name] if you don't respond within [X hours]."
     - On confirm: write monitoredConsentedAt to monitoring_pairs, set prefs.shareLastKnownLocation=true, write consentedAt to last_known_location prefs
   - Approve button: writes consentAt to monitoring_pairs, sets status='active'
   - Decline button: sets status='declined'

2. Build MonitoredActiveScreen (src/screens/monitored/MonitoredActiveScreen.tsx):
   - Animated heartbeat ring (pulsing circle indicating heartbeat is active)
   - List of active monitors with their names
   - Auto-disclosure toggle per monitor:
     - Shows current state
     - OFF→ON: triggers same confirmation dialog as consent screen
     - ON→OFF: immediately sets shareLastKnownLocation=false AND calls deleteLastKnownLocation(uid)
   - Pause monitoring button (temporarily sets status='paused' in monitoring_pairs)
   - Revoke access button (sets status='revoked')

3. Build LocationRequestScreen (src/screens/monitored/LocationRequestScreen.tsx):
   Real-time listener on location_requests where toUserId == currentUser.uid AND status == 'pending'
   - Request card showing: monitor's name, their message, time of request
   - Auto-disclosure countdown: if autoTriggerAfterH > 0, show "🕐 Auto-sharing in [Xh Ym] if you don't respond"
   - Countdown timer that updates every minute
   - Approve button:
     Call Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
     Write GeoPoint to location_requests/{reqId}.location
     Set status='approved', locationType='live', respondedAt=serverTimestamp()
   - Decline button: set status='declined', respondedAt=serverTimestamp()

4. Create src/services/location.ts:
   - requestLocationPermission(): requests WhenInUse permission, returns granted boolean
   - getCurrentLocation(): calls Location.getCurrentPositionAsync, returns GeoPoint
   - getLastKnownLocation(maxAgeMs, requiredAccuracyM): calls Location.getLastKnownPositionAsync with params, returns GeoPoint or null
   - deleteLastKnownLocation(uid): deletes last_known_location/{uid} document from Firestore

5. Create src/stores/monitoredStore.ts (Zustand):
   - State: pendingRequests[], activeMonitors[], shareLastKnownLocation boolean
   - Actions: setPendingRequests, setActiveMonitors, setSharePreference

6. Wire the monitored navigation:
   - On login as monitored role: check for pending monitoring_pairs → show consent screen if pending
   - After consent: show MonitoredActiveScreen
   - Pending location requests: show LocationRequestScreen as a modal overlay or dedicated tab

7. Commit with message: "Phase 3 — monitored flow complete"

Acceptance criteria — confirm each before committing:
- Consent screen shows correctly with auto-disclosure toggle OFF by default
- Tapping auto-disclosure toggle ON shows the exact two-statement confirmation dialog
- Approving a location request writes a GeoPoint to Firestore AND sets locationType='live'
- Revoking auto-disclosure immediately deletes last_known_location/{uid} document
- Monitor dashboard (Phase 2) updates in real-time when monitored person approves a request

Do NOT start Phase 4 work. Stop here.
```

---

### After Phase 3 — What You Do Manually

1. Test the full two-sided flow: monitor sends request, monitored person receives and approves it.
2. Verify in Firestore that location data disappears from location_requests after approval (it should — Phase 4 adds the cleanup function, but test the manual case first).
3. Test the revoke flow: confirm last_known_location document is deleted.
4. Mark Phase 3 complete in CLAUDE.md.

---

## PHASE 4 — CLOUD FUNCTIONS

### Before You Start Phase 4

1. Phases 0–3 complete and committed ✓
2. You have run `firebase login` in your terminal and are logged in ✓
3. You have run `firebase use --add` and selected your safesignal Firebase project ✓
4. Node 20 confirmed installed ✓

---

### Phase 4 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phases 0–3 are complete.

Phase 4 goal: All four Firebase Cloud Functions deployed and working. Firestore security rules covering all 6 collections.

Your tasks for Phase 4:

1. Set up functions folder:
   cd functions
   npm install typescript firebase-admin firebase-functions
   npm install -D @types/node
   Ensure tsconfig.json has: "strict": true, "target": "es2017", "module": "commonjs"

2. Create functions/src/types.ts with TypeScript interfaces mirroring all 6 Firestore schemas (same as app-side types).

3. Create functions/src/inactivityChecker.ts:
   - Scheduled: every 15 minutes
   - Queries monitoring_pairs where status == 'active'
   - For each pair, reads heartbeats/{monitoredId}
   - Computes hoursAgo = (now - lastSeen) / 3600000
   - If hoursAgo >= threshold_hours: send FCM to monitorId
   - FCM notification title: "[Name] has been inactive for [X] hours"
   - FCM notification body: "Tap to check in or send a location request"
   - Do not re-alert if an alert was already sent within the last threshold_hours / 2 (use a sentAlertAt field on monitoring_pairs to track)

4. Create functions/src/locationCleanup.ts:
   - Trigger: onDocumentUpdated for location_requests/{reqId}
   - Fires when status changes to 'approved' or 'resolved'
   - Waits 60 seconds (use setTimeout wrapped in a Promise)
   - Deletes the location field (set to null) on the document
   - Log: "Location cleaned up for request {reqId}"

5. Create functions/src/locationRequestTimeout.ts (EXACTLY as specified in CLAUDE.md):
   - Scheduled: every 30 minutes
   - Queries location_requests where status == 'pending' AND autoTriggerAfterH > 0
   - For each: compute hoursWaiting = (now - requestedAt) / 3600000
   - Skip if hoursWaiting < autoTriggerAfterH
   - Verify monitoring_pairs/{fromUserId}_{toUserId} exists AND monitoredConsentedAt is not null
   - If last_known_location/{toUserId} exists:
     batch.update: status='auto_resolved', location=locData.location, locationType='last_seen', autoTriggeredAt=now, lastKnownRecordedAt=locData.recordedAt
     Send FCM to monitor: "Auto-disclosed: [name]'s last known location from [X] hours ago has been shared."
   - If last_known_location/{toUserId} does NOT exist:
     batch.update: status='auto_resolved', locationType='unavailable', autoTriggeredAt=now
     Send FCM to monitor: "Auto-disclosure triggered but no location is available — location services may be disabled on [name]'s phone."
   - NEVER silently fail on timeout — always send a push notification to the monitor

6. Create functions/src/inviteHandler.ts:
   - HTTP onRequest function
   - Accepts: { monitorId, monitoredDisplayName, thresholdHours, autoDisclosureAfterH }
   - Creates monitoring_pairs doc with status='pending'
   - Returns: { pairId, deepLink: "safesignal://consent?pairId={pairId}" }

7. Create functions/src/index.ts exporting all four functions.

8. Create firestore.rules covering all 6 collections:
   - users/{uid}: read/write only if request.auth.uid == uid
   - monitoring_pairs/{pairId}: read if auth.uid in [monitorId, monitoredId]; write if auth.uid == monitorId; update consentAt fields if auth.uid == monitoredId
   - heartbeats/{uid}: write only if auth.uid == uid; read if auth.uid is a monitor in an active pair with uid
   - location_requests/{reqId}: write if auth.uid == fromUserId; update if auth.uid == toUserId; read if auth.uid in [fromUserId, toUserId]
   - last_known_location/{uid}: write if auth.uid == uid AND resource.data.shareLastKnownLocation == true (enforce via app logic, rule prevents writes without consent); read if auth.uid in monitors of uid with active pairs; delete if auth.uid == uid
   - subscriptions/{uid}: read if auth.uid == uid; write only from Admin SDK (Cloud Functions)

9. Test locally before deploying:
   firebase emulators:start --only functions,firestore
   Test inactivityChecker by manually creating a heartbeat doc with an old timestamp.

10. Deploy:
    firebase deploy --only functions
    firebase deploy --only firestore:rules

11. Commit with message: "Phase 4 — Cloud Functions and Firestore rules deployed"

Acceptance criteria — confirm each before committing:
- inactivityChecker triggers FCM when a heartbeat is older than threshold
- locationCleanup removes location field ~60s after approval
- locationRequestTimeout correctly handles both the "location available" and "location unavailable" cases
- All Firestore rules block unauthorised reads/writes

Do NOT start Phase 5 work. Stop here.
```

---

### After Phase 4 — What You Do Manually

1. In Firebase Console → Functions, verify all 4 functions appear.
2. Trigger a test: manually set a heartbeat's lastSeen to 25 hours ago in Firestore, wait up to 15 minutes, confirm you receive a push notification.
3. Trigger a timeout test: create a pending location_requests doc with autoTriggerAfterH=1 and requestedAt=2 hours ago, wait up to 30 minutes for auto-resolution.
4. Mark Phase 4 complete in CLAUDE.md.

---

## PHASE 5 — SUBSCRIPTIONS + POLISH

### Before You Start Phase 5

1. Phases 0–4 complete and committed ✓
2. Create a free RevenueCat account at app.revenuecat.com ✓
3. In RevenueCat: create a new project called "SafeSignal", add iOS app, copy the API key ✓
4. In RevenueCat: create 3 products (all $0 for family testing): safesignal_free, safesignal_family_monthly, safesignal_pro_monthly ✓

---

### Phase 5 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phases 0–4 are complete.

Phase 5 goal: RevenueCat subscriptions wired, feature gates enforced, all screens polished with loading states and error handling.

My RevenueCat iOS API key is: [PASTE YOUR REVENUECAT API KEY HERE]

Your tasks for Phase 5:

1. Create src/stores/subscriptionStore.ts (Zustand):
   - State: plan ('free'|'family'|'pro'), isActive, isLoading
   - Action: refreshSubscription() — calls Purchases.getCustomerInfo()
   - On app launch: call Purchases.configure({ apiKey }) then refreshSubscription()

2. Create src/services/subscriptions.ts:
   - configurePurchases(userId): Purchases.configure + Purchases.logIn
   - getOfferings(): returns Purchases.getOfferings()
   - purchasePlan(packageToBuy): Purchases.purchasePackage
   - restorePurchases(): Purchases.restorePurchases
   - getCurrentPlan(): reads from Purchases.getCustomerInfo()

3. Build SubscriptionPlansScreen (src/screens/shared/SubscriptionPlansScreen.tsx):
   - Calls getOfferings() to get dynamic pricing
   - Shows 3 plan cards: Free, Family, Pro
   - Each card lists features from CLAUDE.md subscription tiers
   - Auto-disclosure feature is shown as LOCKED on Free plan with upgrade prompt
   - "Most Popular" badge on Family plan
   - Restore Purchases link at bottom
   - Loading state while fetching offerings

4. Enforce feature gates throughout the app:
   - AddContactModal: if plan=='free' AND existing contacts >= 2, show upgrade prompt instead of form
   - ContactDetailScreen auto-disclosure block: if plan=='free', show locked state with "Upgrade to Family" CTA
   - EmergencyModal timeout picker: if plan=='free', hide auto-timeout option with lock icon

5. Polish all screens — add to every screen:
   - Loading spinner while Firestore data is fetching
   - Empty state illustration + message when lists are empty
   - Error boundary with "Something went wrong — tap to retry" 
   - Offline banner using @react-native-community/netinfo: "You're offline — showing last known data"

6. Update SettingsScreen:
   - Add: current plan display with upgrade button
   - Add: "Privacy & Data" section explaining exactly what data is stored
   - Add: "Delete my data" option (writes a deletion_requests doc — actual deletion handled server-side, out of scope for MVP)
   - Persist all preferences to users/{uid}/preferences sub-collection via firestore.ts

7. Handle the "no location available" graceful case throughout the UI:
   - LocationRequestScreen: if location permission denied, show: "Your location services appear to be off. You can still decline this request."
   - Monitor ContactDetail: if locationType=='unavailable', show: "Auto-disclosure triggered but no location was available on [name]'s phone."

8. Add app icon and splash screen placeholders (use a simple shield emoji rendered as an icon — proper design can come later)

9. Run full end-to-end test:
   - Two devices, one monitor one monitored
   - Full flow: add contact → consent → heartbeat active → inactivity alert → location request → auto-disclosure countdown visible → approve/decline
   - Confirm subscription gates work

10. Commit with message: "Phase 5 — subscriptions, feature gates, polish complete"

Do NOT start Phase 6 work. Stop here.
```

---

### After Phase 5 — What You Do Manually

1. Test the subscription flow end to end (even at $0, the purchase flow should work).
2. Test the offline banner by turning off wifi.
3. Invite 1–2 family members to test the app via Expo Go before going to TestFlight.
4. Mark Phase 5 complete in CLAUDE.md.

---

## PHASE 6 — TESTFLIGHT

### Before You Start Phase 6

1. Phases 0–5 complete and committed ✓
2. Apple Developer account ($99/year) enrolled at developer.apple.com ✓
3. Run `eas login` in terminal — log in with your Apple ID ✓
4. Run `eas build:configure` in your project folder ✓
5. In Apple Developer portal: create an App ID for com.safesignal.app with Push Notifications capability ✓
6. In Firebase Console → Project Settings → Cloud Messaging: upload your APNs key (.p8) from Apple Developer portal ✓

---

### Phase 6 Prompt — Paste This Into Claude Code

```
Read CLAUDE.md for full project context. Phases 0–5 are complete.

Phase 6 goal: A working TestFlight build that can be installed on family members' iPhones without the App Store.

Your tasks for Phase 6:

1. Create PrivacyInfo.xcprivacy file (required for iOS 17.4+):
   Declare the following data types collected:
   - NSPrivacyCollectedDataTypeEmailAddress — for authentication
   - NSPrivacyCollectedDataTypeCoarseLocation — only when user consents to auto-disclosure
   - NSPrivacyCollectedDataTypeDeviceID — not collected (explicitly state: false)
   Mark all location collection as: user-initiated (not tracking), with prior consent

2. Update app.json for production:
   - Change minimumInterval in heartbeat from 60 (test) to 900 (15 minutes)
   - Add privacy manifest plugin reference
   - Ensure EAS projectId is set (from eas.json after eas build:configure)

3. Create eas.json if not already present:
   - preview profile: iOS only, simulator: false, distribution: internal
   - production profile: iOS only, distribution: store

4. Run the preview build:
   eas build --platform ios --profile preview
   This will prompt for Apple credentials on first run — follow the prompts.
   Report back the build URL from EAS dashboard.

5. Once build is complete: provide exact instructions for:
   - How to upload the .ipa to App Store Connect
   - How to create a TestFlight group
   - How to invite testers by email

6. Create a testing checklist document at docs/testing_checklist.md covering:
   - Heartbeat fires within 15 min (check Firestore)
   - Inactivity alert received after threshold (check push notification)
   - Location request sent and received
   - Approve location: GeoPoint written, locationType='live'
   - Decline location: status='declined'
   - Auto-disclosure countdown visible
   - Auto-timeout fires (test with 1h timeout)
   - Auto-disclosure unavailable case (disable location services, test again)
   - Revoke consent: last_known_location doc deleted
   - Subscription gate: free plan blocks >2 contacts

7. Commit with message: "Phase 6 — TestFlight build ready"

After the build is submitted to TestFlight, the app is ready for family testing.
```

---

### After Phase 6 — What You Do Manually

1. Download TestFlight on your iPhone (free from App Store).
2. Open the TestFlight invitation email and install the app.
3. Invite family members via their email addresses in App Store Connect → TestFlight.
4. Run through the testing checklist in docs/testing_checklist.md.
5. Log any bugs as GitHub Issues.
6. Mark Phase 6 complete in CLAUDE.md — you're live on TestFlight. 🎉

---

## QUICK REFERENCE

| Phase | What Gets Built | Time Estimate |
|-------|----------------|---------------|
| 0 | Project scaffolding, folder structure, TypeScript types | 1–2 hours |
| 1 | Firebase auth, navigation shell, heartbeat background task | 1 day |
| 2 | Monitor dashboard, contact detail, location requests | 2–3 days |
| 3 | Monitored consent, auto-disclosure toggle, approve/decline | 1–2 days |
| 4 | Cloud Functions, Firestore security rules | 1–2 days |
| 5 | RevenueCat subscriptions, feature gates, polish | 1–2 days |
| 6 | TestFlight build, Apple setup | 1 day |

**Total: ~2–3 weeks of focused work**
