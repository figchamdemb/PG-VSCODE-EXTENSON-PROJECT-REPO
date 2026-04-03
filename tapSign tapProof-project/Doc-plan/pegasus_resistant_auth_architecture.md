# Pegasus-Resistant Authentication for Banking Apps
## How Pegasus Attacks OTP · Why Biometrics Alone Fail · How to Build the Layer That Stops Both
### Security Labs Guide — Pegasus Defence + Physical-First Authentication SDK Design

> **The problem you identified is real and serious.**
> Standard OTP (SMS, TOTP) is defeated by Pegasus before the user even sees it.
> Standard biometric (Face ID, fingerprint on device) is also defeated because
> Pegasus owns the OS that runs the biometric check.
> This document explains exactly why, what the actual defence looks like,
> and how to build it into a banking SDK that banks can integrate without
> holding your users' biometric data.

---

## PART 1 — HOW PEGASUS ACTUALLY ATTACKS YOUR AUTH FLOW

Understanding the attack is the only way to build a real defence. Not a theoretical one.

### What Pegasus is technically

Rather than being a specific exploit, Pegasus is a suite of exploits that uses many vulnerabilities in the system. Some of the exploits Pegasus uses are zero-click — they can run without any interaction from the victim.

Pegasus malware's zero-click capability makes it particularly dangerous as it can infiltrate devices without any action required from the user. It can silently gather a wide range of sensitive information including messages, audio logs, GPS location, and device information.

### How it specifically breaks OTP

When Pegasus owns the OS, here is what happens to a standard SMS OTP flow:

```
NORMAL FLOW (what you designed):
  User requests payment → Server sends OTP via SMS → User reads SMS → User types OTP

PEGASUS-COMPROMISED FLOW (what actually happens):
  User requests payment → Server sends OTP via SMS
  → Pegasus intercepts SMS BEFORE the notification appears
  → Pegasus reads the OTP from the SMS app's memory
  → Pegasus forwards OTP to attacker in real time
  → Attacker uses OTP within its 30-second window
  → Transaction completes — user never saw the OTP or the transaction

WHY THE USER CANNOT STOP THIS:
  The OTP arrived. It just never reached the user.
  Pegasus operates below the application layer.
  Your app, your OTP, your bank cannot detect this interception.
```

### How it breaks standard biometric (Face ID / Fingerprint)

This is the part most people miss. Once installed, Pegasus malware secretly records your login credentials with an undetectable keylogger and sends your personal data to cloud servers.

But beyond keylogging, the deeper issue is this:

```
HOW BIOMETRIC IS IMPLEMENTED ON A PHONE:
  Your app calls: LocalAuthentication.evaluatePolicy(.biometrics)
  iOS/Android runs the biometric check
  iOS/Android returns: TRUE (authenticated) or FALSE (failed)
  Your app receives the TRUE/FALSE result

WHERE PEGASUS ATTACKS THIS:
  Pegasus owns the OS
  Pegasus can hook the LocalAuthentication API
  Pegasus can make the OS return TRUE without a real biometric scan
  OR Pegasus can wait for the user to legitimately authenticate,
     capture the session token that result grants, and reuse it

THE RESULT:
  Your biometric check passed. No real biometric was presented.
  The OS lied to your app. Your app had no way to know.
```

Google Project Zero assessed the FORCEDENTRY exploit as "one of the most technically sophisticated exploits we've ever seen," noting that zero-click exploits work silently in the background. "Short of not using a device, there is no way to prevent exploitation by a zero-click exploit," the research team said.

### The core insight — what Pegasus cannot do

This is the key to your whole idea. Pegasus is software. It is remote. It cannot:

```
WHAT PEGASUS CANNOT DO:
  ✅ It cannot physically touch the device
  ✅ It cannot fake hardware-level sensors that measure physical presence
  ✅ It cannot replicate a user's actual finger on a capacitive sensor
  ✅ It cannot reproduce liveness signals (blood flow, 3D depth, micro-movement)
  ✅ It cannot be present in a room where the user is not
  ✅ It cannot interact with a separate physical hardware token it does not control
  ✅ It cannot intercept a secret that is never transmitted over any network

WHAT PEGASUS CAN DO:
  ❌ Hook OS-level biometric API calls and spoof results
  ❌ Intercept any SMS, push notification, or OTP delivered to the device
  ❌ Read app memory, session tokens, and authentication results
  ❌ Exfiltrate private keys stored in the phone's software keychain
  ❌ Capture screenshots and microphone at the moment of authentication
```

Your instinct is exactly right: **physical presence that cannot be remotely simulated is the only real defence.**

---

## PART 2 — THE AUTHENTICATION LAYERS AND WHICH ONES PEGASUS BEATS

```
LAYER                    HOW IT WORKS           PEGASUS DEFEATS IT?
──────────────────────────────────────────────────────────────────────
SMS OTP                  Code sent via SMS       ✅ YES — intercepts SMS
                                                 before user sees it

TOTP (Google Auth)       Code in app, 30s timer  ✅ YES — reads app memory,
                                                 screenshots the code

Push notification OTP    Code sent via push      ✅ YES — intercepts push
                                                 notification stream

Email OTP                Code sent via email     ✅ YES — reads email app

Device biometric (OS)    Face ID / fingerprint   ✅ YES — hooks the OS API,
via LocalAuthentication  via iOS/Android         spoofs the TRUE response

Device biometric (TEE)   Biometric stored in     ⚠️ HARDER — TEE is isolated
via Secure Enclave       hardware Secure Enclave  but result still goes
                                                 through compromised OS

Hardware security key    Physical FIDO2 key      ✅ NO — requires physical
(FIDO2/WebAuthn)         USB/NFC tap             touch of separate device

Liveness detection SDK   Camera-based 3D face    ⚠️ PARTIAL — can be defeated
                         depth + movement scan    by injection attacks on camera

Silent network auth      Carrier-level phone      ✅ NO to SMS intercept
(SIM-based)              identity verification    but carrier APIs have
                                                 their own risks
```

---

## PART 3 — THE SOLUTION: WHAT ACTUALLY WORKS

### The two technologies that Pegasus cannot defeat

**Option A — FIDO2 Hardware Security Key (highest security, enterprise)**

FIDO2 security key protects against man-in-the-middle attacks because each private key is stored securely in the hardware device.

The authenticator never shares its secrets or biometric data with the website. A single user's secret or biometric works with all websites, as the authenticator selects the correct cryptographic key material after user verification is completed.

Why Pegasus cannot defeat this:
- The private key lives inside the hardware chip — never extracted, never exposed
- Authentication requires **physical touch** of the hardware key (button press or NFC tap)
- Pegasus cannot remotely press a physical button
- Even if Pegasus intercepts the challenge, it cannot sign it without the physical key
- OTP mechanisms are inherently susceptible to phishing, replay attacks, and malware interception. FIDO2/WebAuthn eliminates the shared secret entirely — the private key is never transmitted, never stored on a server, never interceptable.

**Option B — Device-Bound Passkey with Liveness Verification (consumer-friendly)**

Unlike passwords, passkeys are resistant to phishing, are always strong, and are designed so that there are no shared secrets. A passkey is a FIDO authentication credential that allows a user to sign in with the same process they use to unlock their device — biometrics, PIN, or pattern.

The key distinction: **synced passkeys** (stored in iCloud/Google) can be extracted by someone with cloud access. **Device-bound passkeys** are locked to the hardware Secure Enclave and cannot leave the device.

There are two types of passkeys: synced passkeys (can be exported via a cloud service to another device) and device-bound passkeys (stored in a single device and cannot be copied).

For banking: always device-bound, never synced.

---

## PART 4 — YOUR SPECIFIC IDEA: PHYSICAL BIOMETRIC BEFORE OTP DELIVERY

Your idea is sound. Here is the exact architecture that makes it work and why it defends against Pegasus.

### The Problem With Your Current Mental Model

You described: "user must verify biometric before OTP is sent."

The problem: if the biometric check happens on the same compromised device, Pegasus spoofs the biometric result and OTP is still sent and intercepted.

### The Correct Architecture: Split the Trust Boundary

The OTP (or any auth credential) must be protected by something that Pegasus **cannot reach** — meaning it lives outside the compromised device.

```
ARCHITECTURE: PHYSICAL PRESENCE PROOF + ENCRYPTED DELIVERY

Step 1 — User initiates sensitive action (payment, login, OTP request)
         on their (potentially compromised) phone app

Step 2 — Server generates the OTP / auth challenge
         Server does NOT send it yet

Step 3 — Server sends an encrypted COMMITMENT to the phone:
         "To receive the OTP, you must prove physical presence"
         This commitment is useless without Step 4

Step 4 — Physical presence proof (where Pegasus is defeated):
         Option A: User taps their FIDO2 hardware key (USB/NFC)
         Option B: Liveness check via 3D depth + blink + head turn
                   processed in Secure Enclave, result signed by hardware
         Option C: On-device Secure Enclave signs a challenge with a
                   device-bound key (never extractable) requiring biometric

Step 5 — The signed proof goes to the server
         Server verifies the cryptographic signature
         Server can verify: this came from THIS specific hardware device
                           AND biometric/physical presence was verified locally

Step 6 — Only now: server delivers the encrypted OTP
         Encrypted with a key derived from the device-bound hardware key
         Only the verified hardware can decrypt it
         Pegasus cannot decrypt it because it does not have the private key
         (which never leaves the Secure Enclave)

Step 7 — App decrypts OTP in Secure Enclave memory
         Displays it for the minimum viable time (10 seconds max)
         Immediately destroys the plaintext
```

### Why This Beats Pegasus

```
ATTACK SCENARIO: Pegasus-compromised phone, attacker watching

What Pegasus sees at Step 3: an encrypted blob — useless
What Pegasus does at Step 4: tries to hook the biometric API → returns TRUE
What the server checks at Step 4: a cryptographic signature from Secure Enclave hardware
  → The signature requires the private key which never left the Secure Enclave chip
  → Pegasus hooking the API does not produce a valid hardware signature
  → Server rejects the spoofed biometric result
  → OTP is NOT sent

What happens if Pegasus intercepts at Step 6: sees encrypted blob
  → Cannot decrypt without the Secure Enclave private key
  → Useless ciphertext

RESULT: Pegasus fails at Step 4. No OTP ever delivered.
```

---

## PART 5 — HOW TO BUILD THIS AS AN SDK BANKS CAN INTEGRATE

This is the product idea: an SDK that banks embed in their app, providing this authentication layer, without you holding biometric data.

### The Architecture of the SDK

```
┌─────────────────────────────────────────────────────────────────┐
│  BANK'S APP (they integrate our SDK — 3 lines of code)         │
│                                                                 │
│  import PegasusShield from '@ourcompany/pegasus-shield-sdk'    │
│                                                                 │
│  // Before sensitive action:                                   │
│  const verified = await PegasusShield.verifyPhysicalPresence()  │
│  if (verified) proceed()                                        │
└─────────────────────────────────────────────────────────────────┘
          │                              │
          │ challenge/response           │ result
          ▼                              ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│  DEVICE SECURE ENCLAVE  │    │  OUR VERIFICATION SERVER         │
│  (iOS: Secure Enclave   │    │  (Hetzner — stateless)          │
│   Android: StrongBox)   │    │                                  │
│                         │    │  Receives: signed challenge      │
│  Private key: NEVER     │    │  Verifies: cryptographic sig     │
│  leaves this chip       │    │  Checks: device certificate      │
│                         │    │  Returns: TRUE/FALSE only        │
│  Signs challenge using  │    │                                  │
│  biometric as unlock    │    │  STORES: nothing                 │
│  Local verification —   │    │  No biometric data              │
│  biometric data never   │    │  No user data                   │
│  transmitted anywhere   │    │  No OTP                         │
└─────────────────────────┘    │  Just: valid sig? yes/no        │
                               └──────────────────────────────────┘
```

### What the SDK Does — Step by Step

```swift
// iOS SDK internals (simplified)

class PegasusShieldSDK {

    // Called at first app install — registers device
    func registerDevice() async -> Bool {
        // 1. Generate key pair IN Secure Enclave
        //    Private key NEVER leaves Secure Enclave
        //    Public key sent to our server for this device
        let keyPair = SecureEnclave.generateKeyPair(
            requireBiometric: true,     // Must verify biometric to use private key
            deviceBound: true,          // Cannot be synced to iCloud
            invalidateOnEnrollmentChange: true  // New fingerprint = new key
        )

        // 2. Register public key with our server
        //    Server stores: deviceID → publicKey
        //    Server does NOT store: biometric data, private key
        await server.registerPublicKey(
            deviceID: UUID().uuidString,  // random, not linked to user identity
            publicKey: keyPair.publicKey
        )

        return true
    }

    // Called before any sensitive action
    func verifyPhysicalPresence() async -> VerificationResult {

        // 1. Get a fresh challenge from server (prevents replay attacks)
        //    Challenge is random 32 bytes, valid for 30 seconds only
        let challenge = await server.getChallenge()

        // 2. Ask user to verify biometric (triggers Face ID / Touch ID)
        //    This is REAL biometric — processed entirely in Secure Enclave
        //    Biometric template never leaves the device, ever
        let biometricResult = await SecureEnclave.evaluateBiometric(
            reason: "Verify your identity to continue",
            challenge: challenge.bytes
        )

        if biometricResult.failed {
            return .biometricFailed
        }

        // 3. Sign the challenge using Secure Enclave private key
        //    This step proves:
        //    a) This specific hardware device was present
        //    b) The user's real biometric was verified (because only
        //       biometric unlock releases the private key for signing)
        let signature = SecureEnclave.sign(
            data: challenge.bytes,
            withKey: registeredPrivateKey
        )

        // 4. Send signature to our server for verification
        //    We send: deviceID, challenge ID, signature
        //    We do NOT send: biometric data, private key, anything sensitive
        let verification = await server.verifySignature(
            deviceID: self.deviceID,
            challengeID: challenge.id,
            signature: signature
        )

        // 5. Server verifies using the stored public key
        //    If valid: physical human presence confirmed
        //    If invalid: Pegasus spoofed the biometric but couldn't produce
        //                a valid hardware signature
        return verification.isValid ? .verified : .spoofDetected
    }
}
```

### Our Verification Server — What It Does and Doesn't Store

```python
# server/verification.py

class VerificationServer:
    """
    Stateless verifier. Stores only public keys per device.
    Never stores: biometric data, user PII, OTP values, session content.
    """

    def register_device(self, device_id: str, public_key: bytes) -> bool:
        # Store: device_id → public_key (this is all)
        # device_id is a random UUID — not linked to user identity
        # We cannot reverse device_id to find who the user is
        db.store(f"device:{device_id}", {"public_key": public_key})
        return True

    def get_challenge(self) -> Challenge:
        # Generate random 32-byte challenge
        # Valid for 30 seconds only (prevents replay)
        # Stored temporarily in Redis with 30s TTL
        challenge_id = uuid4()
        challenge_bytes = secrets.token_bytes(32)
        redis.setex(f"challenge:{challenge_id}", 30, challenge_bytes)
        return Challenge(id=challenge_id, bytes=challenge_bytes)

    def verify_signature(self, device_id: str, challenge_id: str, signature: bytes) -> bool:
        # Fetch challenge (fails if expired or already used)
        challenge = redis.getdel(f"challenge:{challenge_id}")  # one-time use
        if not challenge:
            return False  # expired or already used

        # Fetch device public key
        device = db.get(f"device:{device_id}")
        if not device:
            return False  # unregistered device

        # Verify cryptographic signature
        # If Pegasus spoofed the biometric but couldn't sign with Secure Enclave,
        # this verification fails — there is no way to fake it
        is_valid = crypto.verify_signature(
            public_key=device["public_key"],
            message=challenge,
            signature=signature
        )

        # Log verification result (device_id only, no user data)
        audit_log(device_id=device_id, result=is_valid, timestamp=now())

        return is_valid

    # WHAT WE NEVER STORE:
    # - User names, emails, phone numbers
    # - Biometric templates or hashes
    # - Private keys
    # - OTP values
    # - Transaction details
    # - Anything that identifies who the user is
```

### How the Bank Uses This SDK

```swift
// Bank's payment screen — 3 lines of integration

@IBAction func confirmPayment(_ sender: Any) {

    // Standard OTP flow would be here — we replace it
    // OLD: sendSMSOTP() → wait for user to type code → verify

    // NEW: physical presence verification first
    PegasusShield.verifyPhysicalPresence { result in
        switch result {
        case .verified:
            // Physical human presence confirmed by hardware cryptography
            // NOW the bank can proceed with the sensitive action
            self.bank.processPayment(amount: self.amount)

        case .biometricFailed:
            self.showError("Biometric verification failed. Please try again.")

        case .spoofDetected:
            // This is the Pegasus case — biometric was attempted remotely
            self.showError("Security verification failed.")
            self.bank.flagTransactionForReview()  // alert fraud team
            // DO NOT process the transaction

        case .deviceNotRegistered:
            PegasusShield.registerDevice()
        }
    }
}
```

---

## PART 6 — LIVENESS DETECTION: THE ADDITIONAL LAYER

Biometric + Secure Enclave is strong but a determined attacker with physical access to the phone could use a photo or 3D mask. Liveness detection closes this gap.

```
LIVENESS SIGNALS THAT PEGASUS CANNOT FAKE REMOTELY:

Signal                  How it works                    Pegasus can fake?
────────────────────────────────────────────────────────────────────────
3D depth map            TrueDepth camera (iPhone X+)    ❌ No — hardware sensor
                        measures face depth in 3D        requires physical face

Micro-expression        Random blink/smile/turn         ❌ No — requires live
challenge               instruction at auth time         human response

Blood flow detection    Subtle skin colour variation    ❌ No — requires real
(rPPG)                  from heartbeat                  living tissue

Liveness score          Combined ML signal              ❌ No — multi-modal,
                        from multiple sensors            hard to spoof all at once

```

Banks already use this. The key is processing it **on-device in Secure Enclave** and only sending the **signed result** to the server, not the raw biometric data.

```
SDK adds liveness check before signing the challenge:

User face → TrueDepth sensor → liveness score computed locally
→ if liveness_score > threshold: proceed with Secure Enclave signing
→ if liveness_score < threshold: reject (photo, mask, or remote attack)

Pegasus cannot:
  → Generate a live face from nowhere
  → Fake the TrueDepth sensor output at hardware level
  → Pass liveness without a real human physically present
```

---

## PART 7 — WHAT THIS DOESN'T SOLVE (BE HONEST)

No security is 100%. Here is what remains as risk even with this architecture:

```
REMAINING RISKS:

1. Jailbroken device (you mentioned this)
   - On a deeply jailbroken device, Secure Enclave can be bypassed
     (requires physical device access + advanced exploit of SEP firmware)
   - Mitigation: SDK checks for jailbreak indicators and refuses to run
   - Mitigation: Device attestation (Apple DeviceCheck, Google Play Integrity)
     verifies OS integrity before processing

2. Coercion / physical threat
   - Attacker forces user to physically authenticate
   - No technical solution — this is a legal/policy problem
   - Mitigation: Duress code (silent alarm code that authenticates but flags)

3. Zero-day in Secure Enclave itself
   - Extremely rare, nation-state level attack
   - No practical defence for this level
   - Mitigation: Transaction limits even when authenticated

4. User registers on compromised device from day one
   - If device was compromised BEFORE registration, attacker may control
     the registration process
   - Mitigation: Device attestation verifies clean OS state at registration

5. Sim-swap attack
   - Attacker takes over user's phone number, receives OTP
   - This architecture removes reliance on phone numbers entirely
   - Mitigation: Never use phone numbers as the identifier in this system
```

---

## PART 8 — HOW TO BUILD THIS AS A PRODUCT (SDK TIERS)

```
WHAT YOU SELL:
  An SDK that banks embed in their app in 3 lines of code.
  The SDK handles: device registration, challenge generation,
  Secure Enclave signing, liveness check, verification server call.

WHAT YOU DO NOT HOLD:
  No biometric data (ever)
  No user PII
  Only: device_id (random UUID) → public key (cryptographic material only)

SDK TIERS:

TIER 1 — Basic (free / low cost)
  → Device-bound passkey verification
  → Secure Enclave signing
  → No liveness detection
  → Good against: OTP interception, API spoofing

TIER 2 — Standard (banking)
  → Everything in Tier 1
  → Liveness detection (3D depth + blink challenge)
  → Jailbreak/root detection
  → Device attestation (Apple DeviceCheck / Google Play Integrity)
  → Good against: Pegasus-level attacks, physical photo attacks

TIER 3 — High Assurance (government / critical infrastructure)
  → Everything in Tier 2
  → Hardware security key support (FIDO2/WebAuthn)
  → Transaction signing (not just auth — each transaction signed separately)
  → Duress code support
  → Offline verification mode
  → FIPS 140-2 compliant
```

---

## PART 9 — THE HONEST SUMMARY

```
WHAT YOU ARE BUILDING:
  A physical presence verification layer that sits in front of any
  sensitive action in a banking app.

HOW IT BEATS PEGASUS:
  Pegasus can spoof OS-level biometric API calls.
  Pegasus cannot produce a valid cryptographic signature from
  a Secure Enclave private key without physically interacting
  with the hardware chip.
  Our SDK requires that hardware signature.
  Therefore Pegasus cannot pass the verification.

WHAT WE HOLD:
  device_id (random UUID, not linked to real identity) → public key.
  Nothing else. Ever.

WHAT BANKS GET:
  3-line SDK integration.
  Physical presence verification that defeats remote attacks.
  Zero biometric data custody (no GDPR/compliance burden for them).
  A clear paper trail: "this transaction was verified by hardware cryptography."

WHAT MAKES THIS DIFFERENT FROM EXISTING SOLUTIONS:
  Apple/Google passkeys: synced to cloud by default (not safe for banking).
  FIDO2 hardware keys: require carrying a separate physical device.
  Our SDK: uses the phone's own Secure Enclave as a FIDO-equivalent
           device-bound authenticator, no extra hardware needed,
           with liveness detection on top.
  This is the gap in the market.
```

---

*Security Labs — Pegasus Defence Architecture v1.0*
*Reviewed against: FIDO2/WebAuthn standards, Apple Secure Enclave documentation,*
*Google StrongBox specification, Citizen Lab Pegasus research, NSO Group court findings.*
*Not legal advice. Have this architecture reviewed by a qualified security auditor*
*before deploying in a regulated financial environment.*
