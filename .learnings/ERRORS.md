# Errors

---

## [ERR-20260510-001] expo_tunnel_ngrok_missing

**Logged**: 2026-05-10T23:59:00-05:00
**Priority**: medium
**Status**: pending
**Area**: mobile

### Summary
`npx expo start --tunnel --clear` failed because Expo required installing `@expo/ngrok` but the command ran non-interactively.

### Suggested Action
Install `@expo/ngrok` explicitly, then retry `expo start --tunnel`.

---
