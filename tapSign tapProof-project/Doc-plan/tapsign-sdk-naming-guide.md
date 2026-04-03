# TapSign SDK — iOS & Android Naming & Identity Guide
## Package Names · Class Names · Method Names · File Conventions · Store Listings

**Product:** TapSign SDK  
**Platforms:** iOS (Swift) · Android (Kotlin) · React Native · Flutter  
**Version:** 1.0.0  
**Purpose:** Physical tap verification before OTP delivery and sensitive actions

---

## PRODUCT IDENTITY

```
FULL NAME:          TapSign SDK
SHORT NAME:         TapSign
DEVELOPER FACING:   TapSign SDK for iOS and Android
TAGLINE:            "Three lines of code. Physical-grade security."
CATEGORY:           Security / Authentication SDK
DEVELOPER NAME:     TapSign Ltd
```

---

## iOS SDK

### Package & Distribution

```
CocoaPods:
  pod 'TapSign', '~> 1.0'
  Source: https://github.com/tapsign/tapsign-ios

Swift Package Manager:
  .package(
    url: "https://github.com/tapsign/tapsign-ios",
    from: "1.0.0"
  )
  Target dependency: "TapSign"

Framework name:     TapSign.xcframework
Bundle identifier:  io.tapsign.sdk
Minimum iOS:        iOS 14.0 (Secure Enclave available from iPhone 5s+)
```

### File Naming

```
tapsign-ios/
├── Sources/
│   └── TapSign/
│       ├── TapSign.swift              ← Main public API (3-line integration)
│       ├── TapSignConfig.swift        ← Configuration
│       ├── TapSignResult.swift        ← Result types / enums
│       ├── Core/
│       │   ├── SecureEnclaveManager.swift   ← Key generation + signing
│       │   ├── BiometricGate.swift          ← LocalAuthentication wrapper
│       │   ├── LocationManager.swift        ← GPS hardware access
│       │   └── DeviceAttestation.swift      ← Apple DeviceCheck
│       ├── Network/
│       │   ├── APIClient.swift              ← Calls api.tapsign.io
│       │   └── WebhookReceiver.swift        ← Receives push from server
│       ├── Recovery/
│       │   ├── RecoveryManager.swift        ← ZKP proof generation
│       │   └── RecoverySetupView.swift      ← SwiftUI recovery phrase UI
│       └── Internal/
│           ├── KeychainHelper.swift
│           ├── Crypto.swift
│           └── GeoHash.swift
├── Tests/
│   └── TapSignTests/
│       ├── TapSignTests.swift
│       ├── CryptoTests.swift
│       └── MockAPIClient.swift
└── TapSign.podspec
```

### Class & Method Naming

```swift
// ============================================================
// PUBLIC API — what the bank developer sees and uses
// ============================================================

import TapSign

// CONFIGURE (call once at app launch)
TapSign.configure(
    apiKey: "ts_live_...",          // API key from dashboard.tapsign.io
    environment: .production         // .production | .sandbox
)

// REGISTER DEVICE (call once on first app launch)
let result = await TapSign.registerDevice()
// Returns: .success(deviceID) | .failure(TapSignError)

// VERIFY (call before any sensitive action)
let result = await TapSign.verify(
    reason: "Confirm payment of £500"   // Shown in biometric prompt
)
// Returns: TapSignResult enum (see below)

// RECOVERY SETUP (call during onboarding — mandatory)
let recoveryResult = await TapSign.setupRecovery(
    method: .recoveryPhrase             // .recoveryPhrase | .platformBackup | .trustedContacts
)

// DISABLE (requires biometric + dual OTP — security-lowering action)
let disableResult = await TapSign.disable(
    service: "barclays_payments",
    reason: "User requested"
)

// ============================================================
// RESULT TYPES
// ============================================================

public enum TapSignResult {
    case verified                       // All 5 criteria passed ✅
    case failed([TapSignCriteria])      // One or more criteria failed
    case biometricFailed                // Face ID / Touch ID not matched
    case deviceNotRegistered            // Call registerDevice() first
    case locationUnavailable            // GPS permission not granted
    case serviceUnavailable             // api.tapsign.io unreachable
    case deviceIntegrityFailed          // Jailbreak detected
}

public enum TapSignCriteria: String {
    case deviceSignature   = "device_signature"    // Secure Enclave proof
    case sessionBinding    = "session_binding"      // TLS session match
    case gpsLocation       = "gps_location"         // Within 10km of request
    case timeWindow        = "time_window"           // 30s expired
    case oneTimeUse        = "one_time_use"          // Already consumed
}

public enum TapSignError: Error {
    case hardwareNotSupported   // Device has no Secure Enclave
    case networkError(Error)
    case registrationFailed
    case configurationMissing   // configure() not called
}

// ============================================================
// INTERNAL CLASS NAMES (not visible to SDK users)
// ============================================================

// All internal classes prefixed with TS (avoids conflicts)
internal class TSSecureEnclaveManager { }
internal class TSBiometricGate { }
internal class TSLocationManager { }
internal class TSAPIClient { }
internal class TSCryptoHelper { }
internal class TSKeychainHelper { }
internal class TSGeoHashEncoder { }
internal class TSDeviceAttestation { }
internal class TSRecoveryManager { }
```

### Notification Names (NSNotification)

```swift
// For apps that need to observe TapSign events
extension Notification.Name {
    static let tapSignVerified        = Notification.Name("io.tapsign.verified")
    static let tapSignFailed          = Notification.Name("io.tapsign.failed")
    static let tapSignDeviceRevoked   = Notification.Name("io.tapsign.device_revoked")
    static let tapSignServiceDown     = Notification.Name("io.tapsign.service_unavailable")
}
```

---

## ANDROID SDK

### Package & Distribution

```
Maven Central:
  implementation 'io.tapsign:sdk:1.0.0'

Gradle (app/build.gradle):
  dependencies {
      implementation 'io.tapsign:sdk:1.0.0'
  }

AAR file:        tapsign-sdk-1.0.0.aar
Package name:    io.tapsign.sdk
Minimum SDK:     API 23 (Android 6.0) — biometric API requirement
Target SDK:      API 34 (Android 14)
StrongBox:       Supported from API 28+ (Android 9+)
```

### File Naming

```
tapsign-android/
├── sdk/
│   └── src/main/
│       ├── kotlin/io/tapsign/
│       │   ├── TapSign.kt                 ← Main public API
│       │   ├── TapSignConfig.kt           ← Configuration data class
│       │   ├── TapSignResult.kt           ← Sealed class result types
│       │   ├── core/
│       │   │   ├── KeystoreManager.kt     ← Android Keystore + StrongBox
│       │   │   ├── BiometricGate.kt       ← BiometricPrompt wrapper
│       │   │   ├── LocationManager.kt     ← GPS hardware access
│       │   │   └── DeviceAttestation.kt   ← Google Play Integrity
│       │   ├── network/
│       │   │   ├── ApiClient.kt           ← Calls api.tapsign.io
│       │   │   └── FcmReceiver.kt         ← Firebase push receiver
│       │   ├── recovery/
│       │   │   ├── RecoveryManager.kt     ← ZKP proof generation
│       │   │   └── RecoverySetupActivity.kt
│       │   └── internal/
│       │       ├── CryptoHelper.kt
│       │       ├── PrefsHelper.kt
│       │       └── GeoHashEncoder.kt
│       └── res/
│           └── values/
│               └── strings.xml            ← Biometric prompt strings
├── sample/                                ← Sample bank app integration
└── build.gradle
```

### Class & Method Naming

```kotlin
// ============================================================
// PUBLIC API — what the bank developer sees and uses
// ============================================================

import io.tapsign.TapSign
import io.tapsign.TapSignResult
import io.tapsign.TapSignConfig

// CONFIGURE (call once in Application.onCreate())
TapSign.configure(
    context = applicationContext,
    config = TapSignConfig(
        apiKey = "ts_live_...",
        environment = TapSignConfig.Environment.PRODUCTION
    )
)

// REGISTER DEVICE (call once on first launch)
TapSign.registerDevice(context) { result ->
    when (result) {
        is TapSignResult.Registered -> { /* store result.deviceID */ }
        is TapSignResult.Error -> { /* handle error */ }
    }
}

// VERIFY (call before any sensitive action)
TapSign.verify(
    activity = this,
    reason = "Confirm payment of £500"
) { result ->
    when (result) {
        is TapSignResult.Verified -> proceedWithPayment()
        is TapSignResult.Failed -> showError(result.failedCriteria)
        is TapSignResult.BiometricFailed -> showBiometricError()
        is TapSignResult.ServiceUnavailable -> handleFallback()
        is TapSignResult.DeviceIntegrityFailed -> blockAction()
    }
}

// ============================================================
// RESULT TYPES
// ============================================================

sealed class TapSignResult {
    object Verified : TapSignResult()
    data class Failed(val failedCriteria: List<String>) : TapSignResult()
    object BiometricFailed : TapSignResult()
    object DeviceNotRegistered : TapSignResult()
    object LocationUnavailable : TapSignResult()
    object ServiceUnavailable : TapSignResult()
    object DeviceIntegrityFailed : TapSignResult()
    data class Registered(val deviceID: String) : TapSignResult()
    data class Error(val message: String, val cause: Throwable? = null) : TapSignResult()
}

// ============================================================
// INTERNAL CLASS NAMES (not visible to SDK users)
// ============================================================

// All internal classes in io.tapsign.internal package
internal class TSKeystoreManager
internal class TSBiometricGate
internal class TSLocationManager
internal class TSApiClient
internal class TSCryptoHelper
internal class TSPrefsHelper
internal class TSGeoHashEncoder
internal class TSDeviceAttestation
internal class TSRecoveryManager
```

### AndroidManifest Permissions (Required)

```xml
<!-- Required permissions — documented for bank developers -->
<!-- Add to their app's AndroidManifest.xml -->

<!-- Biometric authentication -->
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- GPS for location binding (precise location) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

<!-- Network — calls api.tapsign.io -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- StrongBox hardware feature (optional — graceful fallback to TEE) -->
<uses-feature
    android:name="android.hardware.strongbox_keystore"
    android:required="false" />
```

---

## REACT NATIVE WRAPPER

```
npm package:     @tapsign/react-native
Repository:      https://github.com/tapsign/tapsign-react-native
```

```typescript
// Naming in React Native
import TapSign from '@tapsign/react-native';

// Types exported
export type TapSignEnvironment = 'production' | 'sandbox';
export type TapSignResultStatus =
  | 'verified'
  | 'failed'
  | 'biometric_failed'
  | 'device_not_registered'
  | 'service_unavailable'
  | 'device_integrity_failed';

export interface TapSignVerifyResult {
  status: TapSignResultStatus;
  failedCriteria?: string[];
  riskScore?: number;
}

// Usage
TapSign.configure({ apiKey: 'ts_live_...', environment: 'production' });
const result: TapSignVerifyResult = await TapSign.verify('Confirm payment');
```

---

## FLUTTER PLUGIN

```
pub.dev package:  tapsign_flutter
Repository:       https://github.com/tapsign/tapsign-flutter
```

```dart
// Naming in Flutter
import 'package:tapsign_flutter/tapsign_flutter.dart';

// Configure
await TapSign.configure(
  apiKey: 'ts_live_...',
  environment: TapSignEnvironment.production,
);

// Verify
final result = await TapSign.verify('Confirm payment');

switch (result.status) {
  case TapSignStatus.verified:
    // proceed
    break;
  case TapSignStatus.biometricFailed:
    // show error
    break;
  default:
    // handle other cases
}

// Enums
enum TapSignStatus {
  verified,
  failed,
  biometricFailed,
  deviceNotRegistered,
  serviceUnavailable,
  deviceIntegrityFailed,
}

enum TapSignEnvironment {
  production,
  sandbox,
}
```

---

## SDK ERROR CODES

```
Consistent across all platforms (iOS, Android, RN, Flutter):

TS_001   DEVICE_NOT_REGISTERED      registerDevice() not called
TS_002   BIOMETRIC_FAILED           Face ID / Touch ID not matched
TS_003   BIOMETRIC_NOT_AVAILABLE    No biometric enrolled on device
TS_004   HARDWARE_NOT_SUPPORTED     No Secure Enclave / StrongBox
TS_005   INTEGRITY_FAILED           Jailbreak / root detected
TS_006   LOCATION_UNAVAILABLE       GPS permission denied or off
TS_007   NETWORK_ERROR              Cannot reach api.tapsign.io
TS_008   CHALLENGE_EXPIRED          30s window elapsed
TS_009   SIGNATURE_INVALID          Cryptographic signature failed
TS_010   SESSION_MISMATCH           TLS session binding failed
TS_011   LOCATION_MISMATCH          GPS outside 10km tolerance
TS_012   CONFIGURATION_MISSING      configure() not called
TS_013   SERVICE_UNAVAILABLE        TapSign API temporarily down
TS_014   RECOVERY_CODE_INVALID      ZKP proof did not verify
TS_015   DEVICE_REVOKED             This device was deregistered
```

---

## COMPANION APP (TapSign App)

```
iOS App Store:
  Name:           TapSign — Physical Verification
  Bundle ID:      io.tapsign.app
  Category:       Utilities
  Subtitle:       Secure every tap, every time

Google Play:
  Name:           TapSign — Physical Verification
  Package:        io.tapsign.app
  Category:       Tools
  Short desc:     Physical device tap verification for TapSign SDK and TapSign Mail
```

---

## VERSION NUMBERING

```
Format:     MAJOR.MINOR.PATCH (Semantic Versioning)
            1.0.0

MAJOR:      Breaking API change (method renamed, param removed)
MINOR:      New method added, new platform support, new feature
PATCH:      Bug fix, security patch, performance improvement

Release channels:
  Stable:   1.0.0       → production apps
  Beta:     1.1.0-beta  → early access / testing
  Sandbox:  sandbox environment always tracks latest stable

Changelog:  CHANGELOG.md in each repository
            docs.tapsign.io/sdk/changelog
```

---

## INTEGRATION CHECKLIST (For Bank Developers)

```
iOS:
  □ Add TapSign via CocoaPods or SPM
  □ Add NSFaceIDUsageDescription to Info.plist
  □ Add NSLocationWhenInUseUsageDescription to Info.plist
  □ Call TapSign.configure() in AppDelegate.application(_:didFinishLaunchingWithOptions:)
  □ Call TapSign.registerDevice() on first launch
  □ Gate sensitive actions with TapSign.verify()
  □ Set up recovery in onboarding flow

Android:
  □ Add implementation 'io.tapsign:sdk:1.0.0' to build.gradle
  □ Add required permissions to AndroidManifest.xml
  □ Call TapSign.configure() in Application.onCreate()
  □ Call TapSign.registerDevice() on first launch
  □ Gate sensitive actions with TapSign.verify()
  □ Set up recovery in onboarding flow

Both:
  □ Use ts_sandbox_ key for development and testing
  □ Switch to ts_live_ key before production release
  □ Handle TapSignResult.ServiceUnavailable gracefully (fallback)
  □ Never store the API key in version control
     (use environment variables or secure storage)
```

---

*TapSign SDK — iOS & Android Naming Guide v1.0*  
*Add to: /docs/products/tapsign-sdk-naming.md in the master engineering repo*  
*Reference alongside: tapsign-brand-naming-guide.md and tapsign-mail-naming-guide.md*
