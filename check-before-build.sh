#!/usr/bin/env bash
# SafeSignal Pre-Build Validation Script
# Run from the project root: ./check-before-build.sh

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}✔ PASS${RESET}"
FAIL="${RED}✖ FAIL${RESET}"
WARN="${YELLOW}⚠ WARN${RESET}"

# ── Counters ─────────────────────────────────────────────────────────────────
ISSUES=0
FAILURES=()

pass()  { echo -e "  ${PASS}  $1"; }
fail()  { echo -e "  ${FAIL}  $1"; ISSUES=$((ISSUES + 1)); FAILURES+=("$1"); }
warn()  { echo -e "  ${WARN}  $1"; }
header(){ echo -e "\n${BOLD}[$1]${RESET}"; }

# ── Locate project root ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\n${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   SafeSignal — Pre-Build Validation Script   ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo    "  Project: $SCRIPT_DIR"
echo    "  Date:    $(date '+%Y-%m-%d %H:%M:%S')"

# ─────────────────────────────────────────────────────────────────────────────
# 1. SYNC CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "1. SYNC CHECK  (Linux ↔ Windows file sizes)"

WINDOWS_ROOT="/mnt/c/Projects/Safesignal"
SYNC_FILES=(
  "App.tsx"
  "app.json"
  "src/tasks/heartbeat.ts"
  "src/navigation/RootNavigator.tsx"
  "functions/src/index.ts"
)

if [[ ! -d "$WINDOWS_ROOT" ]]; then
  warn "Windows path not mounted: $WINDOWS_ROOT — skipping sync check"
  warn "Mount your Windows drive or adjust WINDOWS_ROOT in this script"
else
  sync_ok=true
  for rel in "${SYNC_FILES[@]}"; do
    linux_file="$SCRIPT_DIR/$rel"
    win_file="$WINDOWS_ROOT/$rel"

    if [[ ! -f "$linux_file" ]]; then
      fail "Sync: Linux file missing — $rel"
      sync_ok=false
      continue
    fi
    if [[ ! -f "$win_file" ]]; then
      fail "Sync: Windows file missing — $rel"
      sync_ok=false
      continue
    fi

    linux_size=$(stat -c%s "$linux_file")
    win_size=$(stat -c%s "$win_file")

    if [[ "$linux_size" -eq "$win_size" ]]; then
      pass "Sync: $rel (${linux_size} bytes)"
    else
      fail "Sync: $rel — Linux=${linux_size}B  Windows=${win_size}B  (diff=$((linux_size - win_size))B)"
      sync_ok=false
    fi
  done
  $sync_ok && pass "All sync files match"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. TYPESCRIPT CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "2. TYPESCRIPT CHECK  (tsc --noEmit)"

if command -v npx &>/dev/null; then
  echo    "  Running tsc in project root…"
  if npx --yes tsc --noEmit 2>&1 | grep -E "error TS" | head -5; then
    fail "TypeScript errors found in root (see above)"
  else
    pass "Root: no TypeScript errors"
  fi

  if [[ -d "functions" && -f "functions/tsconfig.json" ]]; then
    echo    "  Running tsc in functions/…"
    if (cd functions && npx --yes tsc --noEmit 2>&1) | grep -E "error TS" | head -5; then
      fail "TypeScript errors found in functions/ (see above)"
    else
      pass "functions/: no TypeScript errors"
    fi
  else
    warn "functions/tsconfig.json not found — skipping functions TypeScript check"
  fi
else
  warn "npx not found — skipping TypeScript checks"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. FUNCTIONS CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "3. FUNCTIONS CHECK  (functions/src/index.ts exports)"

INDEX="functions/src/index.ts"
EXPECTED_EXPORTS=(
  "inactivityChecker"
  "locationCleanup"
  "locationRequestTimeout"
  "inviteHandler"
  "heartbeatHTTP"
)

if [[ ! -f "$INDEX" ]]; then
  fail "functions/src/index.ts not found"
else
  for fn in "${EXPECTED_EXPORTS[@]}"; do
    if grep -qE "(export|exports\.)\s*\{?[^}]*\b${fn}\b" "$INDEX"; then
      pass "Export found: $fn"
    else
      fail "Export missing: $fn  (not found in $INDEX)"
    fi
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. HEARTBEAT CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "4. HEARTBEAT CHECK  (src/tasks/heartbeat.ts)"

HB="src/tasks/heartbeat.ts"

if [[ ! -f "$HB" ]]; then
  fail "src/tasks/heartbeat.ts not found"
else
  if grep -q "storeUidForBackground" "$HB"; then
    pass "storeUidForBackground exported in heartbeat.ts"
  else
    fail "storeUidForBackground not found in heartbeat.ts"
  fi

  if grep -q "clearUidFromBackground" "$HB"; then
    pass "clearUidFromBackground exported in heartbeat.ts"
  else
    fail "clearUidFromBackground not found in heartbeat.ts"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. FOREGROUND HEARTBEAT CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "5. FOREGROUND HEARTBEAT CHECK  (App.tsx)"

APP="App.tsx"

if [[ ! -f "$APP" ]]; then
  fail "App.tsx not found"
else
  if grep -q "AppState" "$APP"; then
    pass "AppState referenced in App.tsx"
  else
    fail "AppState not found in App.tsx — foreground heartbeat trigger may be missing"
  fi

  if grep -q "checkAndManageContinuous" "$APP"; then
    pass "checkAndManageContinuous called in App.tsx"
  else
    fail "checkAndManageContinuous not called in App.tsx"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. TOKEN CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "6. TOKEN CHECK  (fcmToken saved after login, not before)"

if [[ ! -f "$APP" ]]; then
  fail "App.tsx not found — cannot check token ordering"
else
  # Find the line numbers of key patterns
  token_line=$(grep -n "fcmToken" "$APP" | head -1 | cut -d: -f1)
  auth_line=$(grep -n "onAuthStateChanged\|currentUser\|useAuthStore\|uid" "$APP" | head -1 | cut -d: -f1)

  if [[ -z "$token_line" ]]; then
    fail "fcmToken not written in App.tsx"
  else
    # Check that fcmToken write is inside a user-dependent block
    # Look for fcmToken being written inside a useEffect that depends on uid / currentUser
    if grep -B5 "fcmToken" "$APP" | grep -qE "currentUser|uid|user\b|onAuthStateChanged|logged.in|after.*login"; then
      pass "fcmToken saved inside auth-dependent block (after login)"
    elif grep -A3 -B3 "fcmToken" "$APP" | grep -qE "if.*uid|uid.*&&|currentUser"; then
      pass "fcmToken saved conditionally on uid/currentUser"
    else
      warn "Could not confirm fcmToken is guarded by auth state — review App.tsx manually"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. BACKGROUND MODES CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "7. BACKGROUND MODES CHECK  (app.json UIBackgroundModes)"

if [[ ! -f "app.json" ]]; then
  fail "app.json not found"
else
  if python3 -c "
import json, sys
d = json.load(open('app.json'))
modes = d.get('expo',{}).get('ios',{}).get('infoPlist',{}).get('UIBackgroundModes',[])
needed = {'fetch','remote-notification'}
missing = needed - set(modes)
if missing:
    print('Missing: ' + ', '.join(missing))
    sys.exit(1)
" 2>/dev/null; then
    pass "UIBackgroundModes contains 'fetch' and 'remote-notification'"
  else
    fail "UIBackgroundModes missing 'fetch' and/or 'remote-notification' in app.json"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. APP JSON CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "8. APP JSON CHECK  (version + buildNumber)"

if [[ ! -f "app.json" ]]; then
  fail "app.json not found"
else
  version=$(python3 -c "import json; d=json.load(open('app.json')); print(d.get('expo',{}).get('version',''))" 2>/dev/null)
  build_number=$(python3 -c "import json; d=json.load(open('app.json')); print(d.get('expo',{}).get('ios',{}).get('buildNumber',''))" 2>/dev/null)

  if [[ -n "$version" && "$version" != "None" ]]; then
    pass "version = \"$version\""
  else
    fail "app.json missing expo.version"
  fi

  if [[ -n "$build_number" && "$build_number" != "None" ]]; then
    pass "ios.buildNumber = \"$build_number\""
  else
    fail "app.json missing expo.ios.buildNumber (required for TestFlight)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 9. FIREBASE CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "9. FIREBASE CHECK  (functions/src/ source files)"

EXPECTED_FUNCTIONS_FILES=(
  "functions/src/index.ts"
  "functions/src/inactivityChecker.ts"
  "functions/src/locationCleanup.ts"
  "functions/src/locationRequestTimeout.ts"
  "functions/src/inviteHandler.ts"
  "functions/src/heartbeatHTTP.ts"
  "functions/src/types.ts"
)

for f in "${EXPECTED_FUNCTIONS_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    pass "Found: $f"
  else
    fail "Missing: $f"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 10. GIT CHECK
# ─────────────────────────────────────────────────────────────────────────────
header "10. GIT CHECK  (uncommitted changes)"

if ! command -v git &>/dev/null; then
  warn "git not found — skipping"
else
  if git rev-parse --git-dir &>/dev/null; then
    uncommitted=$(git status --porcelain 2>/dev/null | wc -l)
    if [[ "$uncommitted" -eq 0 ]]; then
      pass "Working tree is clean — all changes committed"
    else
      warn "Uncommitted changes detected ($uncommitted file(s)) — these will NOT be included in the build:"
      git status --short | head -20 | while IFS= read -r line; do
        echo -e "    ${YELLOW}$line${RESET}"
      done
      # Git check is a warning, not a build-blocker — don't increment ISSUES
    fi
  else
    warn "Not a git repository — skipping"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}══════════════════════════════════════════════${RESET}"

if [[ "$ISSUES" -eq 0 ]]; then
  echo -e "\n  ${GREEN}${BOLD}✔  READY TO BUILD${RESET}\n"
else
  echo -e "\n  ${RED}${BOLD}✖  NOT READY — $ISSUES ISSUE$([ "$ISSUES" -gt 1 ] && echo 'S' || echo '') FOUND${RESET}\n"
  echo -e "  ${BOLD}Failed checks:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "    ${RED}•${RESET} $f"
  done
  echo ""
fi

# ─────────────────────────────────────────────────────────────────────────────
# MANUAL TESTING CHECKLIST
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}${BOLD}╔══════════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${YELLOW}${BOLD}║   MANUAL TESTING CHECKLIST — run these on a real device             ║${RESET}"
echo -e "${YELLOW}${BOLD}║                             before every build                       ║${RESET}"
echo -e "${YELLOW}${BOLD}╚══════════════════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  [ ] 1. COLD START HEARTBEAT: Force-close the app completely. Open it. Wait"
echo -e "         10 seconds. Check Firestore → heartbeats → your UID → did lastSeen"
echo -e "         update?"
echo ""
echo -e "  [ ] 2. BACKGROUND HEARTBEAT: Put app in background for 1 minute. Reopen it."
echo -e "         Check Firestore → did lastSeen update?"
echo ""
echo -e "  [ ] 3. LOGIN PERSISTENCE: Force-close app. Reopen. Does it go straight to"
echo -e "         dashboard without asking to log in?"
echo ""
echo -e "  [ ] 4. CONTACT VISIBLE: Open monitor dashboard. Are your test contacts"
echo -e "         showing with a recent timestamp?"
echo ""
echo -e "  [ ] 5. LOCATION REQUEST: Send a location request to a test contact. Do they"
echo -e "         receive a notification? When they approve, does a View Location button"
echo -e "         appear for you?"
echo ""
echo -e "  [ ] 6. FCM TOKEN: Check Firestore → users → your UID → is fcmToken NOT null?"
echo ""
echo -e "  [ ] 7. INVITE FLOW: Tap Add Contact → Send Invite. Do the SMS, WhatsApp and"
echo -e "         Email buttons appear and open correctly?"
echo ""
echo -e "${YELLOW}${BOLD}  Do not submit a build until all 7 manual checks pass.${RESET}"
echo ""

exit "$ISSUES"
