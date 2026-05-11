# Family Hub Mobile

Standalone React Native / Expo APP for Family Hub.

This is separate from the Web version. The Web product is the feature/reference source, but this app has its own mobile codebase, build lifecycle, QA cycle, and store release process.

## Target Stores

- Apple App Store
- Google Play

## Current Build State

Implemented beyond the first shell:

- Warm Family Hub visual system with rounded cards, amber accents, bottom tabs, media rows, invite/member cards, and upload preview
- Bottom tabs:
  - Home
  - Upload
  - Family
  - Notifications
  - Menu
- Chinese / English copy toggle
- Supabase session persistence through SecureStore
- Real sign in / sign up
- Home tab connected to live family name, role, member count, upload count, and recent memories
- Family tab connected to live member list and latest invite code when available
- Notifications tab uses real recent uploads as a lightweight activity feed
- Android media picker and upload flow
- Mobile upload now mirrors the web storage-egress optimization:
  - original object under `original/...`
  - compressed display image under `display/...` at 1600px / JPEG 0.75
  - thumbnail under `thumb/...` at 360px / JPEG 0.7
  - `insert_upload` uses `original_url`, `display_url`, and `thumbnail_url` when the Supabase migration is present, with a legacy RPC fallback
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

1. Parse invite deep links and auto-join after auth.
2. Add native share sheet for invite links/codes and QR generation.
3. Add profile/avatar/theme editing screens with parity to Web.
4. Add push notification registration and notification preferences.
5. Replace placeholder app icon/splash with final Family Hub art.
6. Prepare Android internal testing build first, then TestFlight after Android stabilizes.

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
