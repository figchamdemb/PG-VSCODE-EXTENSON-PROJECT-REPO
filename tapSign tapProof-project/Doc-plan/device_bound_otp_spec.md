# Device-Bound OTP — The Complete Spec
## How to Make OTP Useless to Pegasus Even If They Get It at the Same Time as You
### Physical Tap Required · OTP Bound to Device + Session + Location · No Password Storage

> **What this document answers:**
> 1. If Pegasus gets the OTP at the same time as me — can they use it?
> 2. How do we bind OTP to the physical device so remote use is impossible?
> 3. What criteria must be met before the server accepts ANY OTP?
> 4. How does geolocation factor in without VPN bypass?
> 5. How does recovery work without storing anything sensitive?
> 6. Can this work for email send verification too?

---

## PART 1 — THE RACE CONDITION PROBLEM (AND WHY YOU ARE RIGHT)

You identified this correctly. Here is the exact problem:

```
SCENARIO: Pegasus is on the device. User taps biometric. OTP is delivered.

Timeline:
  T=0.0s  User taps phone (biometric verified locally)
  T=0.1s  OTP delivered to device
  T=0.1s  Pegasus ALSO reads OTP (same millisecond — it owns the OS)
  T=0.2s  User sees OTP on screen
  T=0.5s  User begins typing OTP into app

RACE CONDITION:
  Pegasus has the OTP at T=0.1s
  OTP expires at T=30s (standard)
  Pegasus has ~29.5 seconds to use it from a remote machine
  Can they win the race? YES — easily.

YOUR QUESTION: How do we make the OTP useless even if Pegasus gets it?

ANSWER: Bind the OTP to criteria that Pegasus cannot satisfy from a remote machine.
        The OTP becomes a key that only opens ONE specific lock.
        Pegasus has the key — but they are standing in front of the wrong lock.
```

---

## PART 2 — THE FIVE BINDING CRITERIA (ALL MUST MATCH)

Every OTP must be cryptographically tied to verified user identity, device integrity, and geolocation context, preventing impersonation and spoofing.

Here are the five things the server checks before accepting ANY OTP. Pegasus must satisfy ALL five simultaneously. They can satisfy at most two.

```
CRITERION 1 — DEVICE BINDING (Secure Enclave signature)
  The OTP was generated for a specific device public key.
  To use the OTP, you must also present a valid Secure Enclave signature
  from that same device's private key.
  → Pegasus on a remote machine: FAILS. They do not have the private key.
  → Pegasus on the actual device: must wait for user to physically tap.

CRITERION 2 — SESSION BINDING (TLS session fingerprint)
  The OTP is bound to the specific TLS session that requested it.
  Using the OTP from a different TLS session (different connection) = rejected.
  → Pegasus extracting OTP and replaying from their own connection: FAILS.
  → Different IP, different TLS handshake = different session = OTP rejected.

CRITERION 3 — GEOLOCATION WINDOW (GeoHash tolerance)
  The OTP request came from location X.
  The OTP redemption must come from within N kilometres of location X.
  N is set based on risk (e.g. 5km for payments, 50km for login).
  → Pegasus operator sitting in another country: FAILS.
  → Pegasus on device: same location as user — this criterion passes,
    but they still fail the others.

CRITERION 4 — TIME WINDOW (30 seconds, non-extendable)
  Standard. But combined with the other criteria, this window is much harder to exploit.
  An attacker has 30 seconds to satisfy ALL criteria simultaneously.

CRITERION 5 — ONE-TIME USE + IMMEDIATE INVALIDATION
  OTP is deleted server-side the moment it is redeemed OR the moment it expires.
  No second attempt. No retry with same OTP.
  → Redis: store OTP with 30s TTL. On first use: GETDEL (get and delete atomically).
  → Even if attacker copies it in time, the first use by the real user invalidates it.
```

### How all five work together against Pegasus

```
WHAT PEGASUS HAS:
  ✅ The OTP digits (intercepted from device memory)
  ✅ The device ID (they own the OS, they can read it)
  ✅ An approximate location (GPS on phone, they can read it)

WHAT PEGASUS DOES NOT HAVE:
  ❌ The Secure Enclave private key (never extractable from hardware)
  ❌ The original TLS session (established between the app and server)
  ❌ The ability to be physically present at the user's location with a valid connection

WHAT THE SERVER REQUIRES TO ACCEPT THE OTP:
  All five criteria simultaneously.

RESULT:
  Pegasus has 2 of 5 criteria (OTP digits + approximate location).
  They are missing: Secure Enclave signature + original TLS session + physical presence.
  OTP is REJECTED.
  The OTP they stole is useless.
```

---

## PART 3 — THE COMPLETE TECHNICAL ARCHITECTURE

### How OTP is generated (server side)

```python
# server/otp_generator.py

import secrets
import hashlib
import redis
import json
from dataclasses import dataclass

@dataclass
class OTPContext:
    """Everything the OTP is bound to at generation time."""
    device_id: str          # registered device UUID
    session_fingerprint: str # SHA256 of TLS session ID + client hello
    geohash: str            # GeoHash precision 5 (~5km box) of request origin
    timestamp: float        # Unix timestamp of generation

def generate_bound_otp(
    device_id: str,
    tls_session_id: str,
    client_ip: str,
    user_lat: float,
    user_lon: float
) -> dict:
    """
    Generate an OTP that is cryptographically bound to device + session + location.
    The OTP itself is a normal 6-digit number — user experience unchanged.
    The binding is enforced server-side invisibly.
    """

    # 1. Generate the OTP digits (user sees this)
    otp_digits = str(secrets.randbelow(900000) + 100000)  # 6-digit

    # 2. Generate a binding token (user never sees this)
    #    This ties the OTP to the specific device + session
    binding_token = secrets.token_hex(32)

    # 3. Compute session fingerprint
    session_fingerprint = hashlib.sha256(
        f"{tls_session_id}:{client_ip}".encode()
    ).hexdigest()

    # 4. Compute GeoHash for location binding
    geohash = encode_geohash(user_lat, user_lon, precision=5)  # ~5km accuracy

    # 5. Build OTP context — stored server-side
    context = OTPContext(
        device_id=device_id,
        session_fingerprint=session_fingerprint,
        geohash=geohash,
        timestamp=time.time()
    )

    # 6. Store in Redis with 30-second TTL
    #    Key: binding_token (sent to device with OTP delivery)
    #    Value: context + otp_hash (we store HASH of OTP, not plaintext)
    otp_hash = hashlib.sha256(otp_digits.encode()).hexdigest()

    redis.setex(
        f"otp:{binding_token}",
        30,  # 30 second TTL
        json.dumps({
            "otp_hash": otp_hash,
            "device_id": context.device_id,
            "session_fingerprint": context.session_fingerprint,
            "geohash": context.geohash,
            "timestamp": context.timestamp
        })
    )

    # 7. Return to app:
    #    - OTP digits (shown to user OR auto-filled — never displayed if biometric confirms)
    #    - binding_token (app holds this, never shown to user)
    #    - OTP is ENCRYPTED with device public key before transmission
    encrypted_otp = encrypt_with_device_public_key(device_id, otp_digits)

    return {
        "encrypted_otp": encrypted_otp,    # Only device Secure Enclave can decrypt
        "binding_token": binding_token,    # App includes this when redeeming
        "expires_in": 30
    }
```

### How OTP is verified (server side) — ALL FIVE CRITERIA

```python
def verify_bound_otp(
    otp_submitted: str,
    binding_token: str,
    device_signature: bytes,      # Secure Enclave signature of the binding_token
    redemption_ip: str,
    redemption_lat: float,
    redemption_lon: float,
    redemption_tls_session: str
) -> VerificationResult:
    """
    Verify OTP against all binding criteria.
    ALL must pass. Fail any one = reject.
    """

    # ATOMIC: get and delete in one operation
    # If Pegasus already used the OTP, this returns None and real user is rejected
    # If real user redeems first, Pegasus gets None
    stored = redis.getdel(f"otp:{binding_token}")
    if not stored:
        return VerificationResult.EXPIRED_OR_ALREADY_USED

    context = json.loads(stored)

    # CRITERION 1 — OTP digits match
    submitted_hash = hashlib.sha256(otp_submitted.encode()).hexdigest()
    if submitted_hash != context["otp_hash"]:
        return VerificationResult.WRONG_OTP

    # CRITERION 2 — Device binding (Secure Enclave signature)
    device_public_key = db.get_device_public_key(context["device_id"])
    if not crypto.verify_signature(device_public_key, binding_token.encode(), device_signature):
        # Pegasus cannot produce this — private key never leaves Secure Enclave
        return VerificationResult.DEVICE_SIGNATURE_INVALID

    # CRITERION 3 — Session binding
    redemption_session_fp = hashlib.sha256(
        f"{redemption_tls_session}:{redemption_ip}".encode()
    ).hexdigest()
    if redemption_session_fp != context["session_fingerprint"]:
        # Different TLS session = different connection = reject
        # Pegasus replaying from their machine = different session = REJECTED
        return VerificationResult.SESSION_MISMATCH

    # CRITERION 4 — Geolocation binding
    redemption_geohash = encode_geohash(redemption_lat, redemption_lon, precision=5)
    if not geohash_within_tolerance(context["geohash"], redemption_geohash, km=10):
        # Request came from too far away — flag for fraud review
        flag_for_fraud_review(context["device_id"], redemption_ip, "geolocation_mismatch")
        return VerificationResult.LOCATION_MISMATCH

    # CRITERION 5 — Time window (enforced by Redis TTL — already expired if > 30s)
    # Redis already handled this — if we got here, it's within 30 seconds

    # ALL CRITERIA PASSED
    audit_log(device_id=context["device_id"], result="SUCCESS", criteria_all_passed=True)
    return VerificationResult.VERIFIED
```

### How OTP is delivered and used (app / SDK side)

```swift
// iOS SDK — complete OTP flow

class BoundOTPFlow {

    func requestAndVerify(action: SensitiveAction) async -> AuthResult {

        // STEP 1: Biometric tap (physical presence required)
        //         This is the "you must physically tap the device" gate
        let biometricResult = await SecureEnclave.evaluateBiometric(
            reason: "Confirm \(action.description)"
        )
        guard biometricResult.success else { return .biometricFailed }

        // STEP 2: Get current location (for geolocation binding)
        let location = await LocationManager.getCurrentLocation()

        // STEP 3: Request OTP from server
        //         Server generates OTP bound to: this device + this TLS session + this location
        let otpResponse = await server.requestOTP(
            deviceID: self.deviceID,
            latitude: location.lat,
            longitude: location.lon
            // TLS session ID is automatically included in the HTTPS connection
        )

        // STEP 4: Decrypt OTP using Secure Enclave
        //         OTP was encrypted with our device public key
        //         Only our Secure Enclave private key can decrypt it
        //         Pegasus cannot decrypt this — they don't have the private key
        let otpPlaintext = await SecureEnclave.decrypt(
            ciphertext: otpResponse.encrypted_otp
        )

        // STEP 5: AUTO-FILL or display to user
        //         For high-security mode: never display — auto-submit directly
        //         For standard mode: display for 10 seconds maximum

        // STEP 6: Sign the binding token with Secure Enclave
        //         This is what proves we are the registered device
        let deviceSignature = await SecureEnclave.sign(
            data: otpResponse.binding_token.bytes
        )

        // STEP 7: Submit OTP with all binding material
        let result = await server.redeemOTP(
            otp: otpPlaintext,
            binding_token: otpResponse.binding_token,
            device_signature: deviceSignature,    // Secure Enclave proof
            latitude: location.lat,
            longitude: location.lon
            // TLS session automatically same (same HTTPS connection)
        )

        return result
    }
}
```

---

## PART 4 — GEOLOCATION: HOW IT WORKS AND HOW VPN DOESN'T BYPASS IT

You asked about VPN — good question. Here is why geolocation in this system is not based on IP address.

```
STANDARD GEOLOCATION (IP-based — VPN bypasses this):
  Server sees request from IP 45.22.33.44
  Looks up IP in MaxMind database → "London, UK"
  VPN user's IP maps to: "Amsterdam, NL" even though they're in London
  Attacker uses UK-based VPN → appears to be in right location
  → VPN defeats IP-based geolocation ❌

OUR GEOLOCATION (GPS + device sensor — VPN cannot spoof this):
  GPS coordinates come from the device's hardware GPS sensor
  This is signed by the Secure Enclave as part of the binding
  → The GPS reading is included in the device signature
  → Faking GPS requires rooting the device and spoofing the sensor
  → On a non-jailbroken device: GPS coordinates cannot be spoofed by software
  → VPN changes your IP. It does not change your GPS coordinates. ✅

ADDITIONAL SIGNAL — Network-based location cross-check:
  Server computes: GPS says London. IP says Amsterdam (VPN).
  Mismatch between GPS location and IP location = risk signal
  Not automatic reject (VPNs are common) but adds to risk score
  High-value transactions: GPS + IP mismatch → step-up verification
```

```python
# server/location_validator.py

def validate_location_consistency(
    gps_lat: float,
    gps_lon: float,
    gps_signed: bool,          # Was GPS reading included in device signature?
    request_ip: str,
    transaction_amount: float
) -> LocationRiskScore:

    ip_location = geoip.lookup(request_ip)
    gps_location = (gps_lat, gps_lon)

    # Distance between GPS and IP-based location
    distance_km = haversine(gps_location, ip_location.coordinates)

    risk_score = 0

    if not gps_signed:
        risk_score += 40  # GPS not hardware-signed = suspicious

    if distance_km > 100:
        risk_score += 20  # Large GPS/IP discrepancy = possible spoofing

    if distance_km > 500:
        risk_score += 40  # Very large discrepancy = likely VPN + GPS spoof attempt

    # High-value transaction with risk: require additional step
    if transaction_amount > 1000 and risk_score > 30:
        return LocationRiskScore.REQUIRE_STEP_UP

    if risk_score > 60:
        return LocationRiskScore.REJECT

    return LocationRiskScore.PASS
```

---

## PART 5 — PASSWORDLESS: NO STORED PASSWORD THAT CAN BE STOLEN

You mentioned this — users should not have a static password that Pegasus or anyone can extract. Here is how it works:

```
REGISTRATION (one time):
  User installs app → biometric registered to device Secure Enclave
  Device public key registered with our server
  No password set. No password stored. Anywhere.

LOGIN:
  App requests challenge from server
  Secure Enclave signs challenge with private key (requires biometric unlock)
  Server verifies signature with stored public key
  Access granted — no password, no OTP, no SMS

SENSITIVE ACTION (payment, transfer, change settings):
  Same Secure Enclave signing + OTP bound to device + session + location
  Five-criteria verification as above

WHAT IS STORED ON OUR SERVER:
  device_id (random UUID) → public key
  That is it. No password. No biometric template. No phone number.

WHAT IS STORED ON DEVICE:
  Secure Enclave private key (never extractable)
  App session token (short-lived, device-bound)
  No password. No OTP seeds.
```

---

## PART 6 — ACCOUNT RECOVERY (The Hard Part — Done Right)

You mentioned this: what if you lose the device? Here is the recovery architecture that does not create a backdoor.

```
RECOVERY METHOD 1 — RECOVERY CODE (offline, physical)
  At registration: generate 24-word BIP39 recovery phrase (like crypto wallets)
  User writes it down physically — never stored digitally anywhere
  Never transmitted to our servers
  On recovery: user enters recovery phrase → re-registers new device
  → Pegasus cannot steal what was never digitally stored

RECOVERY METHOD 2 — PLATFORM PASSKEY BACKUP (Apple/Samsung/Google)
  User can optionally save a device-bound backup to Apple Keychain (encrypted)
  This is stored in iCloud Keychain with hardware encryption
  Accessible only with Apple ID + biometric on a new Apple device
  Trade-off: more convenient, but relies on Apple's security model

RECOVERY METHOD 3 — IN-PERSON VERIFICATION (regulated finance)
  For banking: if device lost and no recovery code → visit branch
  Agent verifies identity documents
  Issues temporary access to set up new device
  This is how banks handle lost hardware tokens today — same model

RECOVERY METHOD 4 — TRUSTED CONTACTS (social recovery)
  User designates 3 trusted contacts
  Recovery requires 2 of 3 to approve (multi-sig style)
  No single party can unlock — requires collusion
  Good for: personal wallets, less suitable for banking compliance

THE RULE:
  Recovery is deliberately inconvenient for high-security use cases.
  Inconvenience for the user = impossibility for an attacker.
  If recovery is easy, it becomes the attack vector.
```

---

## PART 7 — THE EMAIL SEND VERIFICATION IDEA

You asked: can we apply this same principle to email — so you must physically tap your device before an email is sent, preventing impersonation?

**Yes. This exists conceptually and you can build it. Here is how:**

```
THE PROBLEM YOU ARE SOLVING:
  Attacker compromises email account (or spoofs From address)
  Sends phishing email impersonating the user
  Recipient cannot tell it wasn't the real person

YOUR SOLUTION:
  Every email send requires: physical device tap → Secure Enclave signature → email released
  Email cannot be sent without physical presence of the registered device

HOW IT WORKS TECHNICALLY:
  Standard email (SMTP) does not support this natively.
  You need: an email client plugin OR a send-proxy service.

OPTION A — Email client plugin (Outlook, Gmail browser extension):
  Plugin intercepts "Send" button click
  Shows: "Tap your registered device to send this email"
  User taps phone (NFC or Bluetooth ping to phone app)
  Phone app: biometric → Secure Enclave sign → approval sent to plugin
  Plugin releases the email with a cryptographic signature header:
    X-Physical-Auth: <device_signature_of_email_hash>
  Recipient's email client (with our plugin) shows:
    ✅ Physically verified by sender's registered device
    ❌ (no badge) = unverified, treat with caution

OPTION B — Signed email (S/MIME or PGP — existing standard):
  Secure Enclave holds the email signing private key
  Every email is signed with the Secure Enclave key
  Signature is verified by recipient automatically
  Cannot be forged without the physical device
  This is how government and military email signing works today

WHAT THIS SOLVES:
  → Prevents email impersonation (attacker cannot sign without device)
  → Proves email came from a human physically present with their device
  → Cannot be automated by Pegasus (requires physical tap)
  → Works for banking notifications: signed by bank's registered server key

WHAT THIS DOES NOT SOLVE:
  → Hijacked accounts where attacker already has device access
  → Compromised email servers (server-side attack)
  → Social engineering the recipient (they see signed email but trust blindly)
```

---

## PART 8 — THE COMPLETE SPEC SUMMARY

```
WHAT WE ARE BUILDING:
  A 5-criteria OTP binding system where every OTP is:
    1. Bound to a specific device (Secure Enclave signature required to use)
    2. Bound to a specific TLS session (replay from different connection = rejected)
    3. Bound to a geographic location (GPS-signed, ±10km tolerance)
    4. Valid for 30 seconds only (standard)
    5. One-time use with atomic delete (first use wins — second use impossible)

  Physical tap required to RECEIVE the OTP (biometric unlocks Secure Enclave decryption)
  Physical tap required to USE the OTP (Secure Enclave signature must accompany submission)

WHAT PEGASUS CAN DO IN THIS SYSTEM:
  ✅ Read the encrypted OTP from device memory
     → Useless: it is encrypted with device public key, decryptable only by Secure Enclave
  ✅ Wait for user to tap and decrypt — then read the plaintext OTP
     → Useless: they cannot produce the required Secure Enclave signature from a remote machine
  ✅ Know the device ID and approximate GPS location
     → Not enough: they still need the TLS session binding and the hardware signature

WHAT PEGASUS CANNOT DO:
  ❌ Extract Secure Enclave private key (hardware enforcement, not software)
  ❌ Replay OTP in a different TLS session
  ❌ Submit OTP from a different geographic location (GPS is hardware-signed)
  ❌ Use the OTP twice (atomic delete on first use)

NET RESULT:
  Pegasus gets the OTP at the same moment as the user.
  They cannot use it. It is bound to criteria they cannot satisfy remotely.
  They have the key. We changed the lock.

WHAT THE SDK STORES:
  On server: device_id → public key (only)
  On device: Secure Enclave private key (hardware, unextractable)
  Nowhere: biometric template, OTP seeds, passwords, phone numbers

WHAT BANKS INTEGRATE:
  3-line SDK call before any sensitive action
  No biometric data custody
  No password storage
  Regulatory-friendly: "authentication is cryptographically bound to physical device presence"
```

---

*Security Architecture v2.0 — Device-Bound OTP with 5-Criteria Verification*
*Covers: Pegasus race condition defence, session binding, GPS-signed geolocation,*
*passwordless authentication, account recovery, and email send verification.*
*Not legal or regulatory advice. Engage a FIPS/PCI-DSS auditor before production deployment.*
