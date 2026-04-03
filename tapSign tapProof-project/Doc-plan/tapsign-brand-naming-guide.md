# TapSign — Brand & Naming Guide
## Master Brand Reference · All Products · All Platforms · All Naming Conventions

**Brand Name:** TapSign  
**Tagline:** "Your tap. Your proof."  
**Category:** Physical Presence Security SDK  
**Version:** 1.0

---

## THE BRAND IN ONE SENTENCE

TapSign is the security SDK that requires a physical device tap before any sensitive action — OTP delivery, email sending, or financial transaction — making stolen credentials and remote attacks useless.

---

## PRODUCT NAMES

```
PRODUCT 1 — TapSign SDK
  Full name:    TapSign SDK
  Short name:   TapSign
  Description:  Mobile SDK for iOS and Android. Banks and fintechs
                embed this to add physical tap verification before
                any OTP is delivered or sensitive action proceeds.
  Developer ID: @tapsign/sdk

PRODUCT 2 — TapSign Mail
  Full name:    TapSign Mail
  Short name:   TapSign Mail
  Description:  Chrome and browser extension. Requires physical
                device tap before sensitive emails are sent.
                Signs outbound email with device-bound cryptographic
                proof. Recipients see verified badge.
  Developer ID: tapsign-mail (Chrome Web Store)

PRODUCT 3 — TapSign App
  Full name:    TapSign App
  Short name:   TapSign
  Description:  The companion mobile app users install once.
                Receives tap requests from TapSign SDK and
                TapSign Mail. Manages device registration,
                recovery, and registered services.
  App Store ID: TapSign — Physical Verification
```

---

## NAMING CONVENTIONS

### API Keys

```
Format:    ts_{environment}_{client_slug}_{random}
Examples:
  ts_live_barclays_uk_4f9a2b1c3d
  ts_sandbox_monzo_8e7f6g5h4i
  ts_live_flutterwave_ng_2j3k4l5m

Prefix breakdown:
  ts_        → TapSign (always)
  live_      → Production environment
  sandbox_   → Testing environment
  {slug}_    → Client identifier (lowercase, underscores)
  {random}   → 10 random alphanumeric characters
```

### SDK Package Names

```
iOS (CocoaPods):       pod 'TapSign'
iOS (Swift Package):   .package(url: "https://github.com/tapsign/tapsign-ios")
Android (Maven):       com.tapsign:tapsign-android:1.0.0
Android (Gradle):      implementation 'com.tapsign:sdk:1.0.0'
React Native (npm):    @tapsign/react-native
Flutter (pub.dev):     tapsign_flutter
JavaScript (npm):      @tapsign/sdk
```

### Code Naming

```swift
// iOS
import TapSign
TapSign.configure(apiKey: "ts_live_...")
TapSign.verify(reason: "Confirm payment")
TapSign.registerDevice()
```

```kotlin
// Android
import com.tapsign.TapSign
TapSign.configure(context, apiKey = "ts_live_...")
TapSign.verify(activity, reason = "Confirm payment")
```

```typescript
// React Native / JavaScript
import TapSign from '@tapsign/react-native'
TapSign.configure({ apiKey: 'ts_live_...' })
await TapSign.verify('Confirm payment')
```

```dart
// Flutter
import 'package:tapsign_flutter/tapsign_flutter.dart';
TapSign.configure(apiKey: 'ts_live_...');
await TapSign.verify('Confirm payment');
```

### API Endpoints

```
Base URL (production):  https://api.tapsign.io/v1
Base URL (sandbox):     https://sandbox.tapsign.io/v1

Endpoints:
  POST   /v1/register           Register a new device
  GET    /v1/challenge           Request a verification challenge
  POST   /v1/verify              Verify a signed challenge
  POST   /v1/recover             ZKP recovery flow
  POST   /v1/heartbeat           On-premise licence check-in
  GET    /v1/usage               Client usage statistics
  GET    /health                 Health check (Keepalived)
```

### Domain Structure

```
Primary:         tapsign.io         (main website + redirect)
API:             api.tapsign.io     (verification API)
Sandbox:         sandbox.tapsign.io (developer testing)
Admin:           dashboard.tapsign.io
Documentation:   docs.tapsign.io
Status page:     status.tapsign.io
CDN/assets:      cdn.tapsign.io
```

### Email Addresses

```
General:         hello@tapsign.io
Developer SDK:   sdk@tapsign.io
Security:        security@tapsign.io
Enterprise:      enterprise@tapsign.io
Support:         support@tapsign.io
Billing:         billing@tapsign.io
Legal:           legal@tapsign.io
```

---

## TIER NAMES

```
TapSign Free        → 0–1,000 verifications/month, sandbox only
TapSign Growth      → Pay per use, $0.008/verification
TapSign Scale       → Volume pricing, $0.002–0.004/verification
TapSign Enterprise  → Flat rate, on-premise option, white-label
```

---

## "SECURED BY TAPSIGN" BADGE

For client apps to display to their users:

```
Text variants (client chooses):
  "Secured by TapSign"
  "Protected by TapSign"
  "Verified by TapSign"

Badge colours:
  Primary:  #0A2540 (dark navy) + white wordmark
  Light:    White + #0A2540 wordmark
  Minimal:  Grey + grey wordmark (for light UI contexts)
```

---

## WHAT TO NEVER CALL IT

```
❌ TapSign SDK (when referring to the whole company — that is the product)
❌ TapProof (different name — not used)
❌ Physical OTP (internal concept — not the brand name)
❌ SignedSend (internal concept — now called TapSign Mail)
❌ "The TapSign" (no article — just TapSign)

✅ TapSign
✅ TapSign SDK
✅ TapSign Mail
✅ TapSign App
✅ TapSign Enterprise
```

---

*TapSign Brand Guide v1.0*  
*Add this file to: /docs/brand/naming-guide.md in the master engineering repo*
