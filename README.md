# Family Hub Mobile

Standalone React Native / Expo APP for Family Hub.

This is separate from the Web version. The Web product is the feature/reference source, but this app has its own mobile codebase, build lifecycle, QA cycle, and store release process.

## Target Stores

- Apple App Store
- Google Play

## Current Prototype

Implemented first shell:

- Warm, simple family-oriented UI direction
- Bottom tabs:
  - Home
  - Upload
  - Family
  - Notifications
  - Menu
- Chinese / English copy toggle
- Store-ready config placeholders:
  - iOS bundle ID: `ccwu.hima.familyhub`
  - Android package: `ccwu.hima.familyhub`
  - Deep link scheme: `familyhub://`
  - EAS build profiles

## Run Locally

```bash
npm install
npm start
```

Then open with Expo Go or simulator.

## Next Build Steps

1. Add Supabase config and auth session persistence.
2. Implement real sign in / sign up.
3. Parse invite deep links.
4. Connect Home tab to family status.
5. Implement native media picker and upload flow.
6. Add push notification registration.
7. Prepare TestFlight and Google Play Internal Testing builds.

## Store Submission Checklist

- Apple Developer account
- Google Play Console account
- Final app icon and splash
- Privacy policy URL
- Support URL/contact
- App Store screenshots
- Google Play screenshots
- Apple privacy labels
- Google Play data safety form
- Production signing credentials

## Domain Note

The final production domain is not fixed yet. Do not hard-code `hima.ccwu.cc` as the permanent APP domain. Use environment variables for API/web fallback URLs and update them when the final domain is selected.

## Test Readiness Standard

Do not ask Mark to test until the app is more than a technical shell. A testable build must include:

- Complete visual system aligned with the Web Family Hub style: warm dark gradient, glass cards, rounded surfaces, amber accents, polished spacing.
- Full bottom tabs with real mobile screens, not placeholder text.
- Auth, family status, upload, family/invite, notifications, menu/settings, profile/avatar/theme/language entry points.
- Android install/test path verified.
- Clear known-issues list before delivery.
