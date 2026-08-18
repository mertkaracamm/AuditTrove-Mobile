# AuditTrove Mobile

AuditTrove Mobile is the React Native (Expo) client for [AuditTrove](https://github.com/mertkaracamm/AuditTrove), an AI-assisted **document review** service. The app lets users pick a PDF — or scan pages with the camera / pick photos from the gallery — and get a structured, page-referenced review back on their phone: a score, an executive summary, attention points with supporting evidence, key metrics, recommended actions, and questions to ask a professional.

The app runs on both iOS and Android from a single codebase.

> AuditTrove is a decision-support tool — not financial, accounting, investment, tax, or legal advice. For non-financial documents it reports only what the document itself says. Findings must be independently reviewed by a qualified professional before they are relied upon.

## What it reviews

A document type is chosen before review; the analysis and on-screen copy adapt to it. Financial reports are the most deeply supported type.

- Financial reports
- Rental / lease agreements
- Subscription / membership / service commitments
- Insurance policies
- Vehicle purchase / sale agreements
- Employment contracts
- General documents

## Screens

- **Onboarding** — 3-slide intro (shown once), including the privacy commitment
- **Home** — document type picker, upload / scan / gallery, active & recent review cards
- **Analyzing** — live progress; the review runs as a background job, so closing the app doesn't stop it, and a push notification arrives when it's ready
- **Result** — score bar, rationale, executive summary, attention points with page references, key metrics, recommended actions, advisor questions, share
- **History** — past reviews stored locally on the device
- **Settings** — language, replay onboarding, privacy policy, restore purchases
- **Paywall** — monthly / yearly subscription with a 7-day free trial

## How it works

1. The user picks a document type, then selects a PDF, scans pages with the camera, or picks photos from the gallery.
2. Scanned/photographed pages are OCR'd on the device and turned into a page-per-image PDF (`src/scan/scanner.js`).
3. The file is sent to the backend as a background job (`POST /api/v1/audit/async`), and the app polls for the result while a push token is registered for a completion notification.
4. The app renders the structured review and stores it in local history (AsyncStorage).

## Monetization & quota

Free tier allows a limited number of reviews per month. A `pro` subscription (monthly or yearly, 7-day free trial) is sold through RevenueCat and unlocks unlimited reviews. Purchases are guarded by a `PURCHASES_ENABLED` flag so the app doesn't crash under Expo Go.

## Technology

- React Native 0.81 / Expo SDK 54
- React Navigation (native stack)
- react-native-svg (score bar)
- expo-document-picker, expo-image-picker, react-native-document-scanner-plugin (input)
- @react-native-ml-kit/text-recognition (on-device OCR)
- expo-print (image → PDF)
- expo-notifications (push), expo-localization (TR/EN i18n)
- react-native-purchases / RevenueCat (subscriptions)
- AsyncStorage (local history & usage)

## Run locally

Requirements:

- Node.js 20 or later
- An EAS **development build** on a physical device (native modules such as OCR, scanning, notifications, and purchases are not available in Expo Go)

```bash
npm install
npx expo start --dev-client
```

Native modules (ML Kit OCR, document scanner, notifications, purchases) require a development or production build via EAS:

```bash
eas build --profile development --platform ios
```

## Configuration

Backend connectivity is configured in `src/api/client.js`:

| Constant | Default | Description |
| --- | --- | --- |
| `USE_MOCK` | `false` | Return a bundled sample review instead of calling the API |
| `API_BASE_URL` | Railway URL | Base URL of the deployed AuditTrove backend |

Feature flags gate native-only features so older builds and Expo Go stay stable: `SCAN_ENABLED`, `PHOTOS_ENABLED`, `PURCHASES_ENABLED`.

## Project structure

```
AuditTrove-Mobile/
├── App.js                        # Navigation container
├── src/
│   ├── theme.js                  # Brand colors, typography, score scale
│   ├── api/client.js             # Backend client, async job calls, mock mode
│   ├── i18n/                      # translations.js (TR/EN) + locale detection
│   ├── jobs/JobContext.js        # Global background-job tracking & persistence
│   ├── notifications.js          # Expo push registration
│   ├── scan/scanner.js           # OCR + image → PDF
│   ├── storage/                  # history.js, usage.js (local state)
│   ├── components/               # DocTypePicker, ScoreSeal
│   └── screens/                  # Onboarding, Home, Analyzing, Result, History, Settings, Paywall
```

## Project status

AuditTrove Mobile is in pre-release, preparing for App Store and Google Play launch. The full flow (type selection, upload/scan/gallery, background analysis, push, result, history), monetization, auth, and TR/EN localization are implemented and wired to the live backend. Remaining work is store submission — screenshots, listing copy, and TestFlight / closed testing.