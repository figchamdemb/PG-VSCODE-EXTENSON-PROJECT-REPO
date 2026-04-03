# TapSign Mail — Chrome Extension Naming & Identity Guide
## Product Name · Store Listing · File Naming · Code Conventions

**Product:** TapSign Mail  
**Type:** Chrome Extension (Manifest V3)  
**Platforms:** Chrome · Firefox · Edge · Safari (planned)  
**Version:** 1.0

---

## PRODUCT IDENTITY

```
FULL NAME:          TapSign Mail
SHORT NAME:         TapSign Mail
STORE NAME:         TapSign Mail — Physical Email Verification
TAGLINE:            "Tap to send. Proof it's you."
CATEGORY:           Security / Privacy (Chrome Web Store)
DEVELOPER NAME:     TapSign Ltd
```

---

## CHROME WEB STORE LISTING

```
Name (45 char max):
  TapSign Mail — Physical Email Verification

Short description (132 char max):
  Require a physical device tap before sending sensitive emails.
  Cryptographic proof that every email came from you.

Full description:
  TapSign Mail adds a physical verification layer to your email.
  Before any sensitive email is sent, you must tap your registered
  device — proving the email genuinely came from you, not an
  attacker who accessed your account.

  HOW IT WORKS:
  • Install TapSign Mail on Chrome
  • Register your phone with the TapSign app (one time)
  • Choose which email addresses to protect
  • Click Send → tap your phone → email sends with cryptographic signature
  • Recipients with TapSign Mail see a ✅ verified badge

  WHAT IT PROTECTS AGAINST:
  • Account takeover — attacker in your Gmail cannot send as you
  • Email impersonation — forged emails show ⚠️ unverified badge
  • Domain spoofing — every email from your domain is signed
  • The "stolen phone → email reset → account drained" attack

  WORKS WITH:
  • Gmail (mail.google.com)
  • Outlook Web (outlook.live.com, outlook.office365.com)
  • Apple Mail (Safari extension — coming soon)

  YOUR PRIVACY:
  • We store zero email content
  • We store zero personal data
  • We hold only: your device's public key (anonymous)
  • A breach of TapSign servers yields nothing useful to an attacker

  ENTERPRISE:
  • Deploy to all staff via Chrome Enterprise / MDM
  • Set policy: which email domains require signing
  • Admin console: compliance dashboard, signing rate per user
  • Extension is policy-locked — staff cannot remove it

  Requires the free TapSign app on iOS or Android.
```

---

## FILE & FOLDER NAMING

```
Repository name:     tapsign-mail-extension
Chrome store ID:     tapsign-mail
Firefox add-on ID:   tapsign-mail@tapsign.io

Folder structure:
tapsign-mail-extension/
├── manifest.json
├── README.md
├── CHANGELOG.md
├── background/
│   └── service_worker.ts
├── content/
│   ├── gmail.ts
│   └── outlook.ts
├── popup/
│   ├── popup.html
│   └── popup.ts
├── options/
│   ├── options.html
│   └── options.ts
├── shared/
│   ├── api_client.ts       ← calls api.tapsign.io
│   ├── crypto.ts
│   └── storage.ts
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── dist/                   ← built output (gitignored)
```

---

## CODE NAMING CONVENTIONS

### JavaScript / TypeScript

```typescript
// Extension ID in code
const EXTENSION_ID = 'tapsign-mail';
const API_BASE = 'https://api.tapsign.io/v1';
const STORAGE_PREFIX = 'tapsign_mail_';

// Storage keys
const STORAGE_KEYS = {
  deviceID:        'tapsign_mail_device_id',
  protectedEmails: 'tapsign_mail_protected_emails',
  apiKey:          'tapsign_mail_api_key',
  enterprisePolicy:'tapsign_mail_enterprise_policy',
};

// Message types (background ↔ content script)
const MESSAGE_TYPES = {
  VERIFY_SEND:      'TAPSIGN_VERIFY_SEND',
  SEND_APPROVED:    'TAPSIGN_SEND_APPROVED',
  SEND_DENIED:      'TAPSIGN_SEND_DENIED',
  EXTENSION_REMOVED:'TAPSIGN_EXTENSION_REMOVED',
};

// CSS class prefix (avoids conflicts with Gmail/Outlook styles)
// All injected DOM elements use this prefix
const CSS_PREFIX = 'tapsign-mail-';

// Examples:
// tapsign-mail-overlay
// tapsign-mail-modal
// tapsign-mail-verified-badge
// tapsign-mail-unverified-badge
// tapsign-mail-spinner
```

### Email Signature Header

```
Header name:   X-TapSign-Proof
Header format: X-TapSign-Proof: v=1;d={device_id};t={timestamp};s={signature};h={email_hash}

Example:
X-TapSign-Proof: v=1;d=a3f7c291-4b2e;t=1709041980;s=3045022100...;h=sha256:4a7f3b9c...

Fields:
  v=1          Protocol version
  d=           Device ID (anonymous UUID)
  t=           Unix timestamp of signing
  s=           Ed25519 signature (hex)
  h=           SHA256 hash of: recipient + subject + body + timestamp
```

### Verified Badge Text

```
Verified:      ✅ Verified by TapSign
Unverified:    ⚠️ Unverified — not signed by TapSign
Compromised:   🔴 Security alert — signing removed from this account
Policy fail:   🔒 Policy required — this domain requires TapSign signing
```

---

## ENTERPRISE CHROME POLICY

```json
// Chrome Enterprise policy (deployed via MDM / Google Admin)
// Prevents removal, pre-configures settings

{
  "ExtensionSettings": {
    "tapsign-mail-extension-id": {
      "installation_mode": "force_installed",
      "update_url": "https://clients2.google.com/service/update2/crx",
      "blocked_permissions": [],
      "toolbar_pin": "force_pinned"
    }
  },
  "3rdPartyExtensionSettings": {
    "tapsign-mail-extension-id": {
      "enterprise_policy": true,
      "protected_domains": ["company.com", "company.co.uk"],
      "require_signing_for": ["financial", "contract", "confidential"],
      "admin_webhook": "https://yourcompany.com/tapsign-webhook",
      "admin_api_key": "ts_live_yourcompany_..."
    }
  }
}
```

---

## COMPANION APP INTEGRATION

```
The Chrome extension communicates with the TapSign App via:

METHOD 1 — Push notification (default, requires internet):
  Extension → api.tapsign.io → push to TapSign App
  User sees: "TapSign Mail: Tap to send email to [recipient]"
  User taps: Face ID / Touch ID → signed proof returned
  Latency: ~3–5 seconds

METHOD 2 — Bluetooth LE (offline, phone nearby):
  Extension → Web Bluetooth API → TapSign App directly
  No internet required on phone
  User sees same prompt on phone screen
  Latency: ~1–2 seconds (fastest)

METHOD 3 — QR code (fallback, any distance):
  Extension shows QR code in overlay
  User scans with TapSign App camera
  User taps biometric → signed proof returned
  Latency: ~8–10 seconds

DEFAULT FLOW: Push → fallback to QR if push not delivered in 15s
```

---

## VERSION NUMBERING

```
Format:  MAJOR.MINOR.PATCH
         1.0.0

MAJOR:   Breaking change to extension behaviour or API
MINOR:   New email client support, new feature, new policy option
PATCH:   Bug fix, security patch, UI tweak

Chrome store update cadence:
  Security patches:  Within 24 hours of discovery
  Feature releases:  Monthly
  Major versions:    As needed (with 30-day deprecation notice)
```

---

*TapSign Mail Extension — Naming & Identity Guide v1.0*  
*Add to: /docs/products/tapsign-mail-naming.md in the master engineering repo*  
*Reference alongside: tapsign-brand-naming-guide.md and tapsign-sdk-naming-guide.md*
