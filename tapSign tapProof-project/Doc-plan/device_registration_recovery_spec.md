# Device Registration, Multi-Device, Travel & Recovery
## The Complete User Journey for PhysicalOTP and SignedSend
### Every Question Answered: New Laptop · Lost Phone · Recovery · Enterprise Setup

> **The three questions this document answers:**
> 1. If I am on a different laptop or travelling — how does SignedSend work?
> 2. How does a new user register their device for the first time?
> 3. If I lose my phone — how do I recover without creating a backdoor?

---

## PART 1 — THE CORE MENTAL MODEL (Read This First)

Think of it exactly like a car key with a keyless entry fob:

```
YOUR PHONE = the key fob
  → has the private key (Secure Enclave)
  → must be physically present to authorise anything
  → if lost: the car does not open until you get a new fob

YOUR LAPTOP / ANY COMPUTER = the car
  → does NOT need to be a registered device
  → just needs the browser extension installed
  → the computer asks your phone for permission
  → your phone approves it via biometric tap
  → permission granted to that session

THIS MEANS:
  ✅ Works on any laptop — yours, a colleague's, a hotel computer
  ✅ Works on any device with the extension
  ❌ Does NOT require every laptop to be registered
  ❌ The laptop never holds the private key — only your phone does
```

The laptop is just a screen. The phone is the key. The phone can approve actions on any screen.

---

## PART 2 — HOW SIGNEDSEND WORKS ACROSS DEVICES (The Travel Scenario)

### Scenario: You are on a different laptop — colleague's, hotel, new work machine

```
YOU ARE AT: hotel laptop, colleague's computer, new work laptop
YOU HAVE: your phone with SignedSend app installed

WHAT YOU DO:
1. Install SignedSend browser extension on that laptop
   (30 seconds — Chrome Web Store, one click)
   OR: it is already installed if the company deployed it to all machines

2. Write email in Gmail / Outlook as normal

3. Click Send

4. Extension shows: "Tap your phone to send this email"
   Extension shows a QR code OR sends a push notification to your phone

5. On your phone:
   SignedSend app opens (or notification arrives)
   Shows: "Send email to [recipient] — Subject: [subject]"
   You tap Face ID / Touch ID

6. Phone signs the email with your Secure Enclave key
   Sends signed proof back to the browser extension
   Takes about 5 seconds total

7. Email sends — signed with YOUR key
   Even though you sent it from a hotel laptop

WHAT THIS MEANS:
  The laptop never needs to be registered
  The laptop never holds your private key
  You can send from ANY laptop in the world
  Your phone is always the key — it travels with you
```

### What happens if your phone has no internet (airplane, remote area)

```
OPTION A — Bluetooth LE (works offline, no internet needed):
  Phone and laptop are near each other (within 10 metres)
  Extension communicates with SignedSend app via Bluetooth directly
  No internet required on the phone
  Signing happens locally
  Email sends when laptop reconnects to internet

OPTION B — Pre-authorised session (for long offline periods):
  Before going offline: "Authorise this laptop for 8 hours"
  Phone confirms via biometric once
  Laptop gets a time-limited session certificate
  For 8 hours: email sends without needing to tap phone each time
  After 8 hours: requires phone tap again
  Good for: flights, remote areas, day-long conferences
```

---

## PART 3 — DEVICE REGISTRATION: HOW IT WORKS THE FIRST TIME

### For a consumer (individual user)

```
STEP 1 — Download the app
  "YourBrand Trust" from App Store or Play Store
  Takes 2 minutes

STEP 2 — App asks: link to an email address
  This is ONLY for account recovery — not used for authentication
  We store: a hash of the email (we cannot reverse it to find who you are)
  We do NOT store the email address itself
  We cannot use this to identify you

STEP 3 — App generates your key pair in Secure Enclave
  Private key: created inside the chip, never leaves, ever
  Public key: sent to our server and stored against a random device_id
  Takes about 3 seconds — happens automatically

STEP 4 — App asks you to set up recovery (explained fully in Part 5)
  This step is MANDATORY before registration completes
  You cannot skip it — recovery must be set up at registration time

STEP 5 — Done
  Your phone is now registered
  Any app using PhysicalOTP SDK will recognise your device
  SignedSend extension on any laptop will use your phone as the key

WHAT WE STORE AFTER REGISTRATION:
  device_id (random UUID) → public key (Ed25519)
  Hash of recovery email (for account recovery flow only)
  That is it — nothing else

WHAT WE DO NOT STORE:
  Your name
  Your actual email address
  Your phone number
  Any biometric data
  Your location
```

### For an enterprise employee

```
STEP 1 — IT admin deploys via MDM (Mobile Device Management)
  Company pushes YourBrand Trust app to all employee phones automatically
  No manual install needed

STEP 2 — Employee opens app → sees company branding
  "Set up your [CompanyName] security key"

STEP 3 — Employee signs in with their work account (SSO / Google Workspace / Entra ID)
  This links the device_id to their employee account in the company's system
  We still do not hold their real identity — the company's SSO does

STEP 4 — Recovery is set up via company IT (not individual recovery codes)
  If employee loses phone → IT admin resets their device registration
  Employee verifies identity with HR / in person → gets new registration
  Company controls this flow — not us

STEP 5 — Done
  Extension auto-installs on their work laptops via MDM
  SignedSend auto-configured for their email domain
  IT admin can see: who is registered, device count, last verified timestamp
  IT admin cannot see: what emails were sent, what OTPs were used
```

---

## PART 4 — THE RECOVERY PROBLEM (The Hard Truth)

This is where most security systems fail. You asked the right question.

The classic weakness: a recovery by email is less secure than the FIDO2 you wanted to protect.

This is the fundamental tension: **the easier recovery is, the weaker security is.** Every recovery path is a potential attack path. Here is how we resolve this honestly.

### The rule: recovery must be harder than the attack

```
THE ATTACK WE ARE DEFENDING AGAINST:
  Someone steals your phone AND wants to get into your accounts

IF RECOVERY IS EASY (e.g. "reply to recovery email"):
  Attacker steals phone → has your email on the same phone
  Uses email recovery → gets new device registered → bypasses everything
  Security = zero

IF RECOVERY IS HARD (our approach):
  Attacker steals phone → cannot get into your accounts
  Real you loses phone → recovery is inconvenient but possible
  Inconvenience for you = impossible for attacker
  This is the correct trade-off for financial / sensitive use cases
```

---

## PART 5 — THE FOUR RECOVERY METHODS (Layered, User Chooses)

Recovery is set up at registration time. Users choose their recovery tier based on their security needs. They can upgrade later but never downgrade without re-verification.

### METHOD 1 — Recovery Phrase (Highest Security — Consumer Default)

```
WHAT IT IS:
  A 24-word phrase generated at registration (BIP39 standard — same as crypto wallets)
  Displayed ONCE on screen during setup
  Never stored by us anywhere — ever
  User writes it on paper or stores in a physical safe

HOW RECOVERY WORKS:
  User loses phone
  Downloads app on new phone
  Enters 24-word recovery phrase
  App re-generates the same key pair deterministically from the phrase
  New phone is now registered — old phone's registration invalidated

SECURITY LEVEL: Very high
  Even if attacker knows your email, phone number, everything —
  they cannot recover your account without the physical piece of paper

USER EXPERIENCE: Requires user to keep the paper safe
  Losing the paper + losing the phone = permanent lockout
  (This is the correct trade-off for maximum security)

WHO THIS IS FOR:
  Individuals who want maximum security
  Anyone in a high-threat environment
  People who understand the responsibility
```

### METHOD 2 — Platform Backup (Convenient — Lower Security)

```
WHAT IT IS:
  Recovery phrase backed up to Apple iCloud Keychain or Google Password Manager
  Encrypted with your Apple ID / Google account credentials + device biometric
  Accessible only from a new Apple/Google device logged into same account

HOW RECOVERY WORKS:
  User loses phone → gets new iPhone/Android
  Logs into same Apple ID / Google account
  Downloads app → app finds backup in Keychain/Password Manager
  Re-derives key pair → registered on new phone → old phone invalidated

SECURITY LEVEL: Medium-high
  Depends on: strength of Apple ID / Google account security
  Apple has strong protections on iCloud Keychain — end-to-end encrypted
  If Apple ID is compromised: recovery is also compromised

WHO THIS IS FOR:
  Most consumers who want security but also convenience
  People who use Apple or Google ecosystems consistently
  Not suitable for: regulated financial environments, government
```

### METHOD 3 — Trusted Contacts (Social Recovery — Advanced)

```
WHAT IT IS:
  User designates 3 trusted contacts (colleagues, family members)
  Recovery requires 2 of 3 contacts to approve
  No single person can unlock your account — requires collusion

HOW RECOVERY WORKS:
  User loses phone → opens recovery flow from new device
  App sends recovery request to all 3 trusted contacts
  2 of 3 contacts must: open app on their phones + biometric approve
  When 2 approvals received → recovery granted → new phone registered

SECURITY LEVEL: High (for the right use case)
  Attacker must compromise 2 separate people's devices — very difficult
  Suitable for: teams, families, organisations with clear trusted relationships

WHO THIS IS FOR:
  Teams with defined trust relationships
  Less suitable for: individuals who cannot guarantee contacts will respond
```

### METHOD 4 — In-Person Verification (Enterprise / Bank)

```
WHAT IT IS:
  Recovery requires physical identity verification at a bank branch,
  company office, or government-approved verification point

HOW RECOVERY WORKS:
  User loses phone → contacts support
  Verification point confirms: passport / national ID + biometric (face match)
  Support issues one-time recovery token (30-minute window)
  User enters token on new phone → re-registers → old phone invalidated

SECURITY LEVEL: Highest possible
  Cannot be done remotely — requires physical presence + government ID
  Suitable for: banking, regulated finance, government, high-value accounts

WHO THIS IS FOR:
  Banking integrations using PhysicalOTP SDK
  Enterprise accounts where IT admin is the verification point
  Any use case where account value justifies the inconvenience
```

---

## PART 6 — THE RECOVERY CODE (What It Actually Is)

You asked about a recovery code that is shown once and not stored. Here is the exact design:

```
AT REGISTRATION (shown once, then destroyed from our systems):

┌─────────────────────────────────────────────────────────────┐
│  YOUR RECOVERY PHRASE                                        │
│                                                             │
│  Write these 24 words in order and keep them physically safe │
│  We do not store this. If you lose it and lose your phone,  │
│  your account cannot be recovered.                          │
│                                                             │
│  1. abandon    7. brick      13. copper    19. minor        │
│  2. ability    8. bridge     14. coral     20. minute       │
│  3. able       9. brief      15. corn      21. miracle      │
│  4. about     10. bright     16. correct   22. mirror       │
│  5. above     11. bring      17. cost      23. miss         │
│  6. absent    12. brisk      18. cotton    24. mitten       │
│                                                             │
│  [I have written these down safely]  ← must tap to proceed │
│                                                             │
│  [Download as encrypted PDF] [Print]                        │
└─────────────────────────────────────────────────────────────┘

WHAT HAPPENS TO THE PHRASE AFTER THIS SCREEN:
  We delete it from our server immediately after display
  We store only: SHA256 hash of phrase (to verify during recovery)
  We cannot reverse the hash to recover the phrase — it is truly one-way
  The phrase itself exists ONLY on the user's paper / physical storage
```

### Why it cannot be "just a password" stored online

```
IF WE STORED THE RECOVERY PHRASE IN OUR DATABASE:
  Attacker hacks our database → gets all recovery phrases
  Every account in our system recoverable by attacker
  We become the single point of failure — everything we are trying to avoid

BECAUSE WE STORE ONLY THE HASH:
  Attacker gets hash from our database → cannot reverse it → useless
  Recovery phrase exists only where user stored it physically
  Our server cannot recover accounts even if we wanted to
  This is correct design — we are not the weakest link
```

---

## PART 7 — REGISTERED DEVICES: HOW MANY, WHICH ONES

```
CONSUMER (default settings):
  Up to 3 registered devices per account
  Typically: phone (primary) + tablet + spare phone
  Each device has its own key pair in its own Secure Enclave
  Revoking one device does not affect others

  Registering a second device:
    Open app on first (existing) device
    Tap: "Add another device"
    Shows QR code
    Scan QR on second device → second device generates its own key pair
    Both devices are now registered — either can approve actions

ENTERPRISE:
  IT admin sets: maximum devices per employee (typically 2)
  New device registration requires: approval from existing registered device
                                    OR IT admin override
  Lost device: IT admin deregisters it immediately from admin panel
  All active device registrations visible to IT admin

WHAT HAPPENS IF BOTH YOUR DEVICES ARE LOST:
  No registered device → cannot generate new approval
  Must use recovery method (phrase / in-person / trusted contacts)
  This is intentional — if attacker steals both devices, they still cannot access
```

---

## PART 8 — THE COMPLETE FIRST-TIME SETUP FLOW (User Perspective)

This is what a new user actually experiences — step by step, no technical jargon:

```
MINUTE 1:
  Download "YourBrand Trust" from App Store
  Open app → Welcome screen
  Tap: "Set up my security key"

MINUTE 2:
  "Allow Face ID / Touch ID?" → tap Allow
  App creates your security key automatically (happening in background)
  Progress bar: "Creating your unique security key..."

MINUTE 3:
  "Choose how to recover your account if you lose your phone"
  Options shown:
    ○ Recovery phrase (most secure — write down 24 words)
    ○ iCloud / Google backup (most convenient)
    ○ Trusted contacts (requires 2 people to approve)
    ○ In-person verification (for bank accounts — most secure)
  User selects one → sets it up

MINUTE 4:
  Recovery setup screen (varies by method chosen)
  For recovery phrase: 24 words shown → user confirms written down
  For iCloud: automatic → user confirms Apple ID logged in

MINUTE 5:
  "Your security key is ready"
  "Install the browser extension to use it on your computer"
  → Link to Chrome Web Store / Firefox Add-ons
  → QR code to scan on phone if on computer

DONE.
  Total time: 4-5 minutes
  From now on: any tap on their phone = physical presence verified
  Any registered app or extension asks their phone before proceeding
```

---

## PART 9 — THE SIMPLE SUMMARY

```
QUESTION: Does my laptop need to be registered?
ANSWER:   No. Only your phone is registered. The laptop just has
          the browser extension. The phone approves the action.
          Works on any laptop — yours, hotel, colleague's — anywhere.

QUESTION: What if I am travelling with no phone signal?
ANSWER:   Bluetooth LE — phone and laptop communicate directly nearby.
          Or: pre-authorise a session for 8 hours before going offline.

QUESTION: How does a new user register?
ANSWER:   Download app → allow biometric → choose recovery method
          → done in 5 minutes. App handles everything automatically.

QUESTION: Recovery if I lose my phone?
ANSWER:   Recovery phrase (24 words on paper) — most secure.
          iCloud/Google backup — most convenient.
          Trusted contacts — for teams.
          In-person verification — for banking.
          Setup is mandatory at registration — cannot skip it.

QUESTION: Can employees use it on work laptops only?
ANSWER:   If IT deploys via MDM: extension auto-installed on work machines only.
          Personal use: works on any machine with the extension.
          The phone is always the key — the laptop is just the screen.

QUESTION: What if I lose my phone AND my recovery phrase?
ANSWER:   For consumer: account is permanently locked. This is correct.
          Inconvenience for you = impossibility for attacker.
          For enterprise: IT admin verifies identity and resets.
          For banking: in-person branch verification with ID.

QUESTION: Is the recovery code stored anywhere?
ANSWER:   No. Only a hash of it is stored (cannot be reversed).
          The phrase exists only on your paper or physical safe.
          Even we cannot recover your account — we do not have the phrase.
          This is by design.
```

---

*Device Registration & Recovery Spec v1.0*
*Covers: multi-device, travel scenarios, first-time setup, four recovery methods,*
*enterprise MDM deployment, and the mathematical reason recovery codes cannot be stored.*
