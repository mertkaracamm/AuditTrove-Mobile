# AuditTrove Mobile

AuditTrove Mobile is the React Native client for [AuditTrove](https://github.com/mertkaracamm/AuditTrove), a Spring Boot service for AI-assisted review of financial reports. The app lets users upload a PDF report from their phone, sends it to the AuditTrove backend, and presents the structured review — risk score, executive summary, findings with page-referenced evidence, and recommended actions — in a native mobile interface.

The project is built with Expo and runs on both iOS and Android from a single codebase.

> AuditTrove is a decision-support tool, not financial, accounting, investment, tax, or legal advice. Findings must be independently reviewed by a qualified professional before they are relied upon.

## Screens

- **Home** — report upload, supported document types, recent reviews
- **Analysis** — live progress while the report is processed
- **Review report** — risk score gauge, executive summary, findings with page-referenced evidence, recommended actions
- **History** — past reviews stored locally on the device

## How it works

1. The user selects a PDF report on their device.
2. The file is uploaded to the AuditTrove backend (`POST /api/v1/audit`) as multipart form data.
3. The backend extracts the text with Apache PDFBox and produces a structured review with the configured OpenAI model, grounded in the supplied report and its page markers.
4. The app renders the result and stores it in the local review history (AsyncStorage).

The app currently ships with a **mock mode** enabled, which returns a bundled sample review instead of calling the backend. This allows the UI to be developed and tested independently of the deployed service.

## Technology

- React Native 0.81 / Expo SDK 54
- React Navigation
- react-native-svg (risk score gauge)
- expo-document-picker (PDF selection)
- expo-linear-gradient
- AsyncStorage (local review history)

## Run locally

Requirements:

- Node.js 20 or later
- Expo Go on a physical device, or an iOS/Android emulator

```
npm install
npx expo start
```

Scan the QR code with the device camera (iOS) or Expo Go (Android). The device and the development machine must be on the same network; use `npx expo start --tunnel` otherwise.

## Configuration

Backend connectivity is configured in `src/api/client.js`:

| Constant       | Default | Description                                              |
| -------------- | ------- | -------------------------------------------------------- |
| `USE_MOCK`     | `true`  | Return a bundled sample review instead of calling the API |
| `API_BASE_URL` | —       | Base URL of the deployed AuditTrove backend              |

Set `USE_MOCK` to `false` and point `API_BASE_URL` to the deployed service to switch to live reviews. The client expects the response schema documented in the backend repository (`riskScore`, `summary`, `risks`, `recommendations`, `references`).

## Project structure

```
audittrove-mobile/
├── App.js                      # Navigation container
├── src/
│   ├── theme.js                # Brand colors, typography, risk scale
│   ├── api/client.js           # Backend client and mock mode
│   ├── storage/history.js      # Local review history
│   ├── components/ScoreSeal.js # Risk score gauge
│   └── screens/                # Home, Analyzing, Result, History
```

## Project status

AuditTrove Mobile is under active development. The full review flow (upload, analysis, report, history) is implemented against mock data. Live backend integration, authentication, and store submission (App Store / Google Play) are planned alongside the backend's public release work.
