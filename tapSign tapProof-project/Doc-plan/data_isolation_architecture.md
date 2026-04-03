# Data Isolation Architecture
## What We Store · What It Means If We Are Breached · Why Breaking Us ≠ Breaking the Bank
### The Complete Separation of Trust: Our System, The Bank's System, The User's Device

---

## PART 1 — THE CORE PRINCIPLE: THREE SEPARATE VAULTS

```
VAULT 1 — USER'S PHONE (Secure Enclave hardware)
  Contains: private key
  Who controls it: the user's finger/face only
  What happens if breached: impossible — hardware chip, physically unextractable
  What we can do with it: nothing — we never see it

VAULT 2 — OUR SERVER (Hetzner)
  Contains: UUID → public key + ZKP commitment
  Who controls it: us
  What happens if breached: attacker gets public keys and commitments
  What attacker can do with it: nothing useful (explained below)

VAULT 3 — BANK'S SERVER
  Contains: account numbers, balances, transaction history
  Who controls it: the bank
  What happens if breached: serious — but our system is not involved
  What our breach does to bank: nothing — completely separate systems

CRITICAL DESIGN RULE:
  Breaking Vault 2 (our server) does NOT open Vault 1 or Vault 3.
  Breaking Vault 3 (bank) does NOT open Vault 1 or Vault 2.
  The only key that opens anything is in Vault 1 — on the user's hardware.
  And Vault 1 cannot be broken remotely.
```

---

## PART 2 — EXACTLY WHAT WE STORE (AND WHAT IT IS WORTH TO AN ATTACKER)

### Our complete database — every field

```sql
-- This is literally everything in our database

TABLE: registered_devices
  device_id        VARCHAR(36)   -- random UUID e.g. "a3f7-c291-4b2e-9f12"
  public_key       BYTEA         -- Ed25519 public key, 32 bytes
  commitment       BYTEA         -- ZKP commitment for recovery code
  attestation_cert BYTEA         -- Apple DeviceCheck / Google Play cert
  registered_at    TIMESTAMPTZ
  last_verified    TIMESTAMPTZ

TABLE: audit_log
  device_id        VARCHAR(36)   -- same random UUID
  action           VARCHAR(20)   -- "VERIFIED" or "FAILED"
  timestamp        TIMESTAMPTZ
  -- nothing else

THAT IS THE ENTIRE DATABASE.
No names. No emails. No phone numbers. No bank account numbers.
No transaction amounts. No OTP values. No biometric data.
No IP addresses stored permanently. No location data stored.
```

### What an attacker gets if they breach our server

```
ATTACKER GETS:
  device_id: "a3f7c291-4b2e-9f12-..."
  public_key: 0x4a7f3b9c2d1e8f6a...
  commitment: 0x9b2c4d7e1f3a8b5c...
  audit_log: [VERIFIED, VERIFIED, FAILED, VERIFIED]

WHAT CAN THEY DO WITH THIS?

With the device_id alone:
  → It is a random UUID with no link to any real person
  → Cannot look up who owns it
  → Cannot link it to a bank account
  → Cannot link it to an email address
  → Useless

With the public_key:
  → Public keys are MEANT to be public — that is their purpose
  → You cannot sign anything with a public key
  → You cannot derive the private key from the public key
  → Cannot impersonate anyone
  → Useless for attack

With the commitment (recovery code ZKP):
  → Cannot reverse it to get the recovery code
  → Cannot use it to recover any account without also knowing the code
  → Useless

With the audit_log:
  → Knows this UUID verified 3 times and failed once
  → Does not know whose UUID this is
  → Does not know what they were accessing
  → Useless

COMBINED TOTAL VALUE TO ATTACKER: zero
```

---

## PART 3 — THE ANONYMITY CHAIN: HOW WE DO NOT KNOW WHOSE UUID THIS IS

This is the key design. We deliberately have NO way to link our data to a real person.

```
HOW A BANK INTEGRATES OUR SDK:

Bank has: user John Smith, account #4521, email john@email.com
Bank integrates our SDK: 3 lines of code

When John registers on the bank app:
  Our SDK generates: device_id = "a3f7c291-..."  (random, we generate this)
  Our SDK sends to bank: "John's device is registered as a3f7c291"
  Bank stores in THEIR database: John Smith → a3f7c291
  We store in OUR database: a3f7c291 → public_key

WHAT EACH PARTY KNOWS:

  US:         a3f7c291 → public_key   (we do not know this is John Smith)
  THE BANK:   John Smith → a3f7c291   (they know the link)
  JOHN:       His private key (in his phone Secure Enclave)

THE SEPARATION:
  To connect "a3f7c291" to "John Smith" you need the BANK's database
  To verify "a3f7c291" is a valid device you need OUR database
  To actually sign anything you need JOHN'S PHONE

  Three separate systems. All three must be compromised simultaneously.
  That has never happened in any known attack.
```

---

## PART 4 — WHAT HAPPENS IN EACH BREACH SCENARIO

### Scenario A: Attacker breaches OUR server

```
ATTACKER HAS: list of UUIDs and public keys

CAN THEY LOG INTO ANY BANK ACCOUNT?
  Step 1: They need to know which UUID belongs to which person
          → We do not store this mapping → BLOCKED

  Step 2: Even if they guess a UUID, to use it they need to
          generate a valid Secure Enclave signature
          → Private key is on user's phone hardware → BLOCKED

  Step 3: Even if somehow they had the UUID + signature,
          the bank would verify against their own user record
          → They do not have the bank credentials either → BLOCKED

RESULT: Our breach causes zero bank account compromises.
        Attacker has a list of random UUIDs and public keys.
        This is worthless.
```

### Scenario B: Attacker breaches THE BANK's server

```
ATTACKER HAS: John Smith → account details → device_id "a3f7c291"

CAN THEY NOW USE OUR SYSTEM TO IMPERSONATE JOHN?
  Step 1: They know John's UUID is "a3f7c291"
          They can query our verification endpoint
          But our endpoint only accepts: UUID + valid Secure Enclave signature
          → They do not have John's private key → BLOCKED

  Step 2: Can they use John's UUID to register a new device?
          → New device registration requires: current device signature
            OR recovery code (ZKP proof)
          → They have neither → BLOCKED

  Step 3: Can they call us and say "reset device a3f7c291"?
          → Our API has no "reset by UUID" endpoint
          → Reset requires ZKP proof of recovery code → BLOCKED

RESULT: Bank breach does not compromise our system.
        Attacker has John's UUID but cannot do anything with it
        without John's physical phone.
```

### Scenario C: Attacker steals John's phone (physical theft)

```
ATTACKER HAS: John's physical phone

CAN THEY USE IT?
  The phone is locked → requires biometric or PIN to unlock
  Secure Enclave requires biometric to sign anything
  If they cannot pass biometric: BLOCKED at hardware level

  What if they force-reset the phone (factory reset)?
  → Factory reset wipes the Secure Enclave key
  → The device_id "a3f7c291" is now permanently invalid
  → John uses recovery process to register new phone
  → Old phone (even with original firmware restored) cannot sign
     because the Secure Enclave key is gone

  What if they use a PIN they observed?
  → They can unlock the PHONE — not the Secure Enclave for our SDK
  → Our SDK requires biometric specifically (not PIN fallback)
  → This can be enforced: .biometryCurrentSet (iOS) means
     only current enrolled biometrics work — PIN fallback disabled
  → Biometric only: BLOCKED if not the real owner's face/finger

RESULT: Physical phone theft is the hardest attack — but still requires
        the real person's biometric to use our SDK specifically.
```

### Scenario D: ALL THREE breached simultaneously

```
ATTACKER HAS:
  Our database: a3f7c291 → public_key
  Bank database: John Smith → a3f7c291
  John's phone: physical device in hand

NOW THEY HAVE EVERYTHING — but still need John's face or fingerprint.

  Can they fake the biometric?
  → Liveness detection: requires live 3D face depth, blood flow, eye movement
  → A photo does not pass
  → A 3D printed mask has very low success rate on modern sensors
  → A silicone finger cast: possible on some older fingerprint sensors,
     fails on ultrasonic sensors (iPhone 16+, Pixel 8+)

  This is the scenario where physical coercion is the attack vector.
  No technical system defeats physical coercion.
  This is where: transaction limits, time delays, and duress codes apply.
  (Duress code: a second biometric or PIN that silently flags the session
   as coerced — bank freezes account and alerts security)

RESULT: Even all-three breach requires the real person's live biometric.
        Only physical coercion remains — which is a law enforcement problem,
        not a cryptography problem.
```

---

## PART 5 — THE OTP REVEAL ON WEB BANKING (Your First Question)

### How the OTP auto-fills without the user ever reading the digits

```
USER EXPERIENCE ON bank.com (laptop):

1. User visits bank.com/login
   Bank page loads — our SDK JavaScript is embedded (one script tag)

2. User enters username only (no password — passwordless design)

3. Page shows:
   ┌────────────────────────────────────┐
   │  Tap your phone to continue        │
   │  [animated phone icon]             │
   │  Push notification sent to your    │
   │  registered device                 │
   └────────────────────────────────────┘

4. User's phone receives push notification:
   "bank.com login request
    Location: London, UK
    Time: 14:33 UTC
    [APPROVE]  [DENY]"

5. User taps APPROVE → Face ID / Touch ID
   Phone signs the session challenge with Secure Enclave
   Signed proof sent to bank server

6. Bank server verifies signature
   User is now authenticated — no OTP typed, no password typed

7. If bank still requires OTP as secondary factor:
   OTP is generated server-side
   OTP is encrypted with user's public key
   Sent to our relay
   Our relay sends to user's phone (encrypted blob)
   Phone decrypts in Secure Enclave
   Phone sends auto-fill signal to the browser tab via our SDK
   OTP appears in the browser field automatically
   User never reads the digits
   Attacker in the email/SMS sees: encrypted blob — useless

WHAT THE ATTACKER SEES IN THE EMAIL IF OTP SENT VIA EMAIL:
  Subject: Your verification code
  Body:
  ┌────────────────────────────────────────────────────┐
  │  Your verification code is protected               │
  │                                                    │
  │  [PROTECTED — tap your registered device to fill]  │
  │                                                    │
  │  This code will auto-fill on the verified device.  │
  │  It cannot be read from this email.                │
  └────────────────────────────────────────────────────┘

  The actual OTP digits are: not in this email.
  They are in an encrypted attachment that only the
  Secure Enclave on the registered phone can open.
  Attacker reads the email: sees the message above — nothing else.
```

---

## PART 6 — COMPLIANCE: WHAT WE ARE AND ARE NOT RESPONSIBLE FOR

```
WE ARE:
  A cryptographic verification service
  We confirm: "this hardware device was physically present"
  We confirm: "the registered key signed this challenge"
  We return: TRUE or FALSE

WE ARE NOT:
  A data processor of personal data (we hold no PII)
  A financial institution
  Custodians of biometric data
  Responsible for what the bank does after we return TRUE

GDPR / DATA PROTECTION:
  We hold no personal data → GDPR Article 4 definition not triggered
  A UUID and a public key are not "personal data" under GDPR
  because they cannot identify a natural person without
  additional data we do not hold (the bank holds that link)
  We are not a "data processor" under GDPR — we process no personal data
  No DPA (Data Processing Agreement) required between us and the bank
  (though banks may want one for contractual comfort — we can provide it)

PCI-DSS:
  We never touch card data, account numbers, or payment details
  We are out of PCI scope entirely
  Banks do not need to include us in their PCI audit

WHAT THIS MEANS FOR US:
  No GDPR breach notification obligations (no personal data held)
  No PCI compliance required
  No SOC2 required for core functionality
  (SOC2 is still good to have for enterprise trust — but not legally required)
  Lowest possible regulatory burden
  Maximum security
```

---

## PART 7 — THE SUMMARY TABLE

```
IF THIS IS BREACHED:        ATTACKER GETS:           CAN THEY DO ANYTHING?
──────────────────────────────────────────────────────────────────────────
Our server                  UUIDs + public keys      No — useless without
                            ZKP commitments          private key + bank data

Bank's server               Account data + UUIDs     No — useless without
                            John = a3f7c291          private key on phone

User's phone (locked)       Encrypted hardware       No — Secure Enclave
                            chip                     requires live biometric

User's phone (unlocked)     Access to apps           Only what is visible
                            But not our SDK          on screen — SDK requires
                            signing without          fresh biometric each time
                            fresh biometric

Our server + Bank server    UUIDs + account link     No — still need
(both at once)              + public keys            the physical phone

Our server + Phone          Private key signs        No — signature alone
(both at once)              but no bank data         cannot access bank
                            to target               without bank credentials

All three at once           Everything               Yes — but still need
                                                     live biometric
                                                     (coercion scenario)
```

---

## FINAL ANSWER — ONE PARAGRAPH

Our server holds only anonymous UUIDs mapped to public keys. Public keys are designed to be public — you cannot attack anything with them. The link between a UUID and a real person exists only in the bank's database, which we do not control or access. The private key that makes the whole system work exists only in the user's phone hardware and can never be extracted. To do anything useful, an attacker needs all three systems simultaneously AND the user's live biometric. We can be completely breached and the bank is unaffected. The bank can be completely breached and our system is unaffected. The user's phone can be stolen and without their biometric neither system can be abused. This is defence in depth by architecture, not by policy.

---

*Data Isolation Architecture v1.0*
*Three-vault model: device hardware + our verification server + bank system.*
*Breach of any one vault yields nothing useful to an attacker.*
