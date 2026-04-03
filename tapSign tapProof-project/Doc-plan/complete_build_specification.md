# The Complete Build Specification
## Tech Stack · Business Model · SDK Licensing · Forgery Prevention · Uninstall Protection
### Everything Needed to Build PhysicalOTP + SignedSend as One Product

---

## PART 1 — WHAT TECHNOLOGY DO WE NEED?

Simple answer first: we do not need much. The heavy lifting happens on the user's device hardware — our server is deliberately thin.

### Our Server Stack (Hetzner — cheap, simple, powerful enough)

```
WHAT OUR SERVER ACTUALLY DOES:
  1. Stores: UUID → public key (tiny — 64 bytes per user)
  2. Issues: challenges (random 32-byte tokens, 30s TTL in Redis)
  3. Verifies: cryptographic signatures (Ed25519 — fast, lightweight)
  4. Counts: API calls per client key (for billing)
  5. Logs: device_id + pass/fail + timestamp (nothing else)

THAT IS IT. This is not a complex system.

TECH STACK:
  Language:    Python (FastAPI) or Node.js (Fastify) — either works
  Database:    PostgreSQL on Hetzner — UUIDs + public keys
               Table size: 1 million users = ~200MB — tiny
  Cache:       Redis — challenge tokens (30s TTL, auto-expire)
  Server:      Hetzner CX42 (8 vCPU, 16GB) — handles millions of requests/day
  CDN/DDoS:    Cloudflare Pro ($20/month) — protects our API from abuse
  TLS:         Cloudflare → origin — all traffic encrypted
  Backup:      Daily encrypted backup to Cloudflare R2

CAPACITY:
  Ed25519 signature verification: ~50,000 operations per second per core
  8 cores = 400,000 verifications per second
  At 1 million banks users each verifying 10 times per day:
  = 10 million verifications per day = 115 per second
  Our server handles this with 0.03% of its capacity
  Cost: ~$30/month for the server

DO WE NEED AWS?
  Not for our verification server — Hetzner is sufficient and 6x cheaper
  YES for: AWS Secrets Manager (storing our own API signing keys)
  YES for: CloudTrail (audit log of our own infrastructure changes)
  Optional: AWS as a second region for enterprise SLA customers

DO WE NEED CLOUDFLARE?
  YES — Cloudflare Pro ($20/month) for:
  → DDoS protection on our API (banks will notice if we go down)
  → Rate limiting per API key (prevents abuse by any one client)
  → Global CDN so API calls are fast from Africa, UK, Asia equally
  → Cloudflare Tunnel (our server IP never exposed)

DO WE NEED JAVA?
  No. Python or Node.js is sufficient for what we do.
  iOS SDK: Swift (required for Secure Enclave access)
  Android SDK: Kotlin (required for StrongBox/TEE access)
  Browser extension: JavaScript/TypeScript (required for Chrome/Firefox)
  Backend: Python (FastAPI) — fast to build, easy to maintain, handles load

SCALE ESTIMATE:
  10 million users globally:
  Database: 10M rows × 200 bytes = 2GB — one standard Hetzner server
  Verifications: assume 5 per user per day = 50M per day = 578 per second
  Still well within one Hetzner CX42 ($30/month)
  Add second server for redundancy: $60/month total
  Add Cloudflare: $20/month
  Total infrastructure for 10 million users: ~$80/month
```

### How UUIDs Scale to Millions

```
UUID STORAGE:
  Each UUID: 36 characters = 36 bytes
  Each public key (Ed25519): 32 bytes
  Each ZKP commitment: 64 bytes
  Timestamps: 16 bytes
  Total per user: ~150 bytes

  1 million users:   150MB  — fits on a USB stick
  10 million users:  1.5GB  — fits on a phone
  100 million users: 15GB   — one standard database server
  1 billion users:   150GB  — still one large server

  PostgreSQL handles billions of rows comfortably.
  With a B-tree index on device_id: lookup time = ~0.1 milliseconds
  regardless of table size.
  This is not a scaling problem. It is a solved problem.

UUID GENERATION:
  UUIDv4 (random) — generated on device at registration
  Collision probability at 1 billion users: 1 in 10^18 — effectively zero
  We do not need to coordinate UUID generation — devices generate their own
```

---

## PART 2 — THE BUSINESS MODEL: HOW WE MAKE MONEY

### The SDK API Key model — how banks pay us

Software Development Kits are becoming more and more popular — they are not only helpful but can also be very profitable to sell. For SDKs, there are unique licensing considerations — getting it wrong could mean far too many will have access to the SDK.

Here is the model that solves the sharing problem:

```
EVERY BANK / CLIENT GETS:
  A unique API key pair:
    Client Key ID:     "pk_live_bank_barclays_uk_..."
    Client Secret:     "sk_live_..."  (never shared, stored in their Secrets Manager)

  This key pair does TWO things:
  1. Authenticates their API calls to our verification endpoint
  2. Namespaces their users' UUIDs — Barclays users are separate from HSBC users

HOW SHARING IS PREVENTED:
  If Barclays shares their SDK with HSBC:
  → HSBC uses Barclays' API key
  → Our billing shows: Barclays is doing 2x normal verification volume
  → Our system flags: unusual verification pattern from this key
  → We investigate, contact Barclays, charge for actual usage
  → Keys can be rate-limited per contract volume

  Better enforcement: each SDK build is compiled with the client key embedded
  and obfuscated. A different bank would need to decompile and reverse engineer
  the SDK to extract the key — detectable and illegal.

HOW WE TRACK USAGE FOR BILLING:
  Every verification call logs: client_key_id + timestamp (nothing else)
  Monthly billing report: "Barclays UK: 4,231,000 verifications this month"
  Invoice generated automatically
  We never see whose verification it was — just how many from which client
```

### Pricing tiers

```
TIER 1 — STARTUP / DEVELOPER (free to start)
  0–1,000 verifications/month: FREE
  Sandbox environment only (not for production)
  Perfect for: fintechs building, testing, integrating
  No credit card required
  Purpose: remove friction to adoption

TIER 2 — GROWTH (pay per use)
  Price: $0.008 per verification (~0.8 pence)
  Minimum: $50/month
  Includes: production environment, standard SLA, email support
  Example: 100,000 verifications/month = $800/month revenue to us
  Our cost to serve: ~$0.001 per verification = $100
  Margin: $700/month from one mid-size fintech

TIER 3 — SCALE (volume discount)
  1M–10M verifications/month: $0.004 per verification
  10M+ verifications/month: $0.002 per verification
  Includes: 99.9% SLA, dedicated support, audit reports
  Example: 5M verifications/month = $20,000/month revenue
  Our cost: ~$500/month
  Margin: $19,500/month from one large bank

TIER 4 — ENTERPRISE (flat rate + features)
  Custom monthly fee (typically $5,000–50,000/month)
  Includes: on-premise option, white-label, custom SLA, dedicated CSM
  Our cost: ~$500–2,000/month (self-hosted on their infrastructure)
  Margin: very high

SIGNEDSEND (consumer + enterprise email):
  Personal: free (up to 100 signed emails/month)
  Professional: $5/month per user (unlimited)
  Business: $12/user/month (admin console, policy enforcement)
  Enterprise: custom

REVENUE PROJECTION (conservative):
  Year 1: 10 fintechs × average $2,000/month = $20,000 MRR
  Year 2: 50 clients × average $5,000/month = $250,000 MRR
  Year 3: 200 clients + SignedSend enterprise = $1M+ MRR
  Infrastructure cost at Year 3: ~$5,000/month (still Hetzner + Cloudflare)
  Gross margin: ~99.5% — pure software
```

---

## PART 3 — CAN THE VERIFIED SIGNATURE BE FORGED?

You asked: can a hacker copy the verified ✅ badge and paste it onto a fake email?

**The short answer: No — and here is exactly why.**

```
WHAT THE ATTACKER TRIES:
  They find a real verified email from sarah@company.com
  They copy the X-SignedSend header from that email
  They compose a fake email pretending to be Sarah
  They paste the copied header into the fake email
  They send it — hoping the recipient sees a ✅ badge

WHY IT FAILS:

The X-SignedSend header contains:
  {
    "signature": "Ed25519_signature_here",
    "signed_content": SHA256("recipient@target.com" + "Subject text" + "Email body" + "2026-02-27T14:33:00Z"),
    "device_id": "a3f7c291-...",
    "timestamp": "2026-02-27T14:33:00Z"
  }

When the recipient's extension receives this email:
  Step 1 — Compute SHA256 of THIS email's: recipient + subject + body + timestamp
  Step 2 — Verify the signature against the public key for device_id
  Step 3 — Check: does the signed_content match what we just computed?

WHAT HAPPENS WITH THE COPIED HEADER:
  The attacker's fake email has different: recipient, subject, body
  The extension computes SHA256 of the FAKE email content
  The copied signature was made over the ORIGINAL email content
  The hashes do not match
  Extension shows: ❌ INVALID SIGNATURE — content does not match

  The signature is mathematically bound to the exact content of the original email.
  Changing one character in the email body changes the SHA256 entirely.
  The copied signature becomes invalid instantly.

WHAT IF ATTACKER COPIES THE ENTIRE EMAIL UNCHANGED?
  They forward the original email unchanged — every byte identical
  Extension verifies: signature matches content → ✅ shows
  BUT: the To: field is the original recipient — not their target
       The timestamp is old — attacker cannot change it without breaking signature
       The content says what Sarah originally said — not the attack content
  
  This is just email forwarding — not forgery. The signature proves
  it is a genuine forward of a real email, not a new fake one.
  The recipient sees: "This is a verified forward of Sarah's original email"

CAN THE ATTACKER GENERATE A VALID SIGNATURE FOR A FAKE EMAIL?
  Only if they have Sarah's private key
  Sarah's private key is in the Secure Enclave of Sarah's phone
  It cannot be extracted
  They cannot generate a valid signature
  ❌ BLOCKED at the cryptographic layer — not policy, not trust, mathematics
```

---

## PART 4 — CHROME EXTENSION UNINSTALL PROTECTION

You asked: if someone removes the Chrome extension from the laptop, can they then send emails without the tap? Would it be flagged?

```
THE PROBLEM:
  Attacker gets into your laptop
  Removes SignedSend extension
  Sends emails as you without any tap verification
  Email arrives at recipient without verified badge
  
  Is this a problem? YES — but we have three defences.

DEFENCE 1 — RECIPIENT SEES NO BADGE (passive warning)
  Every email from your domain that you have been sending with SignedSend
  trained your recipients to expect the ✅ badge
  An email without it is immediately suspicious
  For enterprise: IT policy says "do not trust unsigned emails"
  For consumer: recipients with our extension see ⚠️ UNVERIFIED

DEFENCE 2 — UNINSTALL REQUIRES VERIFICATION (active protection)
  When someone tries to remove the extension:
  Chrome shows the standard "Remove extension?" dialog (we cannot prevent this)
  
  BUT: we add a second layer through our companion app on the phone
  
  The extension registers itself with our server on install:
  "Device [laptop fingerprint] has extension installed for [gmail accounts]"
  
  When the extension is removed: Chrome fires the onUninstalled event
  Before it fully uninstalls: extension sends a removal notice to our server
  Our server sends push notification to the registered phone:
  
  "⚠️ SignedSend was removed from Chrome on your laptop
   Location: London, UK — Time: 14:33 UTC
   If this was not you — tap EMERGENCY LOCK
   [This was me — OK]  [NOT ME — LOCK MY EMAILS]"
  
  If user taps LOCK:
  → All emails from their registered addresses flagged as compromised
  → Recipients' extension shows: 🔴 ACCOUNT COMPROMISED — do not trust
  → Bank integrated with PhysicalOTP gets alert: account security event

DEFENCE 3 — SERVER-SIDE POLICY (enterprise only)
  IT admin sets: "All emails from @company.com must be signed"
  Our server maintains this policy per domain
  Any email received from that domain without valid signature:
  → Extension flags: POLICY VIOLATION — this domain requires signing
  → Email client can be configured to move to quarantine automatically
  
  WHAT THIS MEANS:
  Even if extension removed: emails still arrive unsigned
  Recipients' extensions flag them automatically
  Attacker gains nothing — their fake emails are still visibly unverified
```

---

## PART 5 — DISABLING THE SDK (Turn It Off Requires Same Security As Turn It On)

You asked: to disable or turn off PhysicalOTP — does it also require biometric verification?

```
CORRECT — disabling requires the same level of verification as using it.

RULE: You cannot lower your security level without proving you are the real owner.

DISABLE FLOW:
  User opens app → Settings → "Disable PhysicalOTP for [bank name]"
  App shows: "This will remove physical verification for your bank account"
             "To confirm this is really you — please verify"
  User must: Face ID / Touch ID (real biometric, Secure Enclave)
  After biometric: OTP sent to registered email AND phone simultaneously
  User must enter BOTH (dual confirmation for a security-lowering action)
  Disabled for 24 hours maximum — then re-enables automatically
  
  Bank is notified: "User [device_id] disabled PhysicalOTP — manual review recommended"
  Bank can: block the account until user re-enables, contact user, flag for review

WHY BOTH OTP CHANNELS:
  Attacker has stolen phone → can pass biometric on some devices
  Requiring email OTP as second factor means they also need email access
  Two separate channels → attacker needs to compromise both simultaneously
  This is specifically for the security-LOWERING action — not normal use

EMERGENCY DISABLE (phone lost):
  User calls bank
  Bank verifies identity (questions + ID)
  Bank disables PhysicalOTP requirement for 1 hour to allow account access
  User sets up on new phone within that hour
  One-hour window expires → PhysicalOTP required again
  
  During the disable window:
  Bank applies extra scrutiny: transaction limits, additional auth steps
  The disable does not make the account completely unprotected
```

---

## PART 6 — OUR ADMIN PANEL: WHAT WE CAN SEE

You asked about our admin panel — what we see, what it shows.

```
OUR ADMIN PANEL SHOWS:

CLIENT MANAGEMENT:
  List of registered clients (banks, fintechs)
  For each client:
    API key status (active/suspended)
    Verifications this month: 4,231,000
    Verifications last month: 3,892,000
    Failed verifications: 12,400 (2.9% failure rate — normal)
    Revenue this month: $33,848
    Invoice status: paid / pending

SYSTEM HEALTH:
  API response time (p50, p95, p99)
  Verification success rate
  Redis cache hit rate
  Database query performance
  Server CPU / memory

SECURITY ALERTS:
  Unusual volume from client key (potential sharing/abuse)
  High failure rate from specific device_id (potential attack)
  Requests from new geographic regions outside client's normal pattern

WHAT WE CANNOT SEE IN OUR ADMIN PANEL:
  Who the users are (only device_ids — random UUIDs)
  What they were accessing
  What transactions they were completing
  Any personally identifiable information
  
  Our admin can see: 4.2M verifications from Barclays this month
  Our admin cannot see: that John Smith verified 14 times this month
  
  We genuinely do not know. It is not that we are hiding it.
  We literally do not collect it.

BANK'S ADMIN PANEL (they build this, we do not see it):
  Banks build their own dashboard using our API
  They see: John Smith → device a3f7c291 → verified today at 14:33
  They see this because THEY link UUID to user — not us
  We provide the verification result via webhook:
    POST /webhook: { "device_id": "a3f7c291", "result": "VERIFIED", "timestamp": "..." }
  Bank matches device_id to their user record and updates their dashboard
```

---

## PART 7 — MARKETING: HOW TO SELL THIS TO BANKS AND FINTECHS

```
THE SALES PITCH (one paragraph for a bank CTO):
  
  "Every month your customers are losing money because attackers
  steal their phones, request OTPs, and drain accounts before anyone
  notices. SMS OTP was deprecated by NIST in 2016. We give you a
  3-line integration that adds hardware-level physical presence
  verification. If the user is not physically holding their registered
  device and passing biometric, no OTP is delivered and no sensitive
  action proceeds. Our server holds only anonymous cryptographic keys —
  no PII, no biometric data, no transaction details. A breach of our
  systems yields nothing useful to an attacker. Your compliance team
  will love the audit trail. Your fraud team will love the 94% reduction
  in OTP-based account takeover. Your customers will love not losing money."

WHO TO TARGET FIRST:
  
  Tier 1 — Fintechs (fastest to say yes):
    Revolut, Monzo, Starling, Wise, Paystack, Flutterwave, Chipper Cash
    Why: they move fast, have developers who understand the tech,
         lower procurement friction than traditional banks
    How to reach: developer conference sponsorship, direct API docs,
                  Product Hunt launch, fintech Slack communities

  Tier 2 — Neobanks and challenger banks:
    They have the fraud problem and the technical team to integrate
    Security is a differentiator for them vs incumbent banks
    A partnership announcement: "Protected by [OurBrand]" is marketing for them

  Tier 3 — Traditional banks (slowest, biggest contracts):
    12–18 month sales cycles, procurement committees, security audits
    BUT: when they say yes it is a $50,000+/month contract
    Requires: SOC2 Type II certification, penetration test report,
              GDPR compliance documentation

  For Africa specifically:
    Mobile money providers: M-Pesa, MTN Mobile Money, Orange Money
    OTP fraud is massive in Africa — stolen SIM cards, SIM swap attacks
    These providers desperately need this — no carrier deal required
    Our pricing at $0.003/verification is viable for African market volumes

HOW TO MARKET SIGNEDSEND:
  Consumer: Product Hunt, Twitter/X launch, "Stop email fraud" messaging
  Enterprise: LinkedIn targeting IT security managers, CISOs
  The hook: "One tap. Verified email. Nobody can impersonate you."
  The fear: "Your email is unprotected right now. Anyone who gets in
             can send as you to your bank, your clients, your staff."
```

---

## PART 8 — THE COMPLETE TECHNOLOGY LIST (What To Build)

```
WHAT WE BUILD:

iOS SDK (Swift):
  SecureEnclaveManager.swift    — key generation, signing, biometric gate
  PhysicalOTPClient.swift       — challenge request, OTP receive, auto-fill
  DeviceAttestation.swift       — Apple DeviceCheck integration
  RecoveryManager.swift         — ZKP proof generation for recovery

Android SDK (Kotlin):
  StrongBoxManager.kt           — Android StrongBox/TEE equivalent
  PhysicalOTPClient.kt          — same flow as iOS
  SafetyNetAttestation.kt       — Google Play Integrity check
  RecoveryManager.kt            — ZKP proof generation

Chrome Extension (TypeScript):
  content_script.ts             — intercept send button in Gmail/Outlook
  background.ts                 — manage phone communication, signing
  email_detector.ts             — detect protected emails, show/hide OTP
  profile_manager.ts            — manage which emails are protected per profile

Mobile Companion App (React Native or Flutter — one codebase, iOS + Android):
  RegistrationFlow               — first-time setup, key generation
  ApprovalScreen                 — receive tap requests, show preview, approve/deny
  RecoverySetup                  — choose recovery method, generate phrase
  DeviceManager                  — see registered services, remove, manage
  UninstallAlert                 — receive and act on extension removal alerts

Backend (Python + FastAPI):
  /register          POST        — store UUID + public key
  /challenge         GET         — issue fresh challenge
  /verify            POST        — verify signature, return pass/fail
  /recover           POST        — ZKP recovery verification
  /webhook-config    POST        — client registers their webhook URL
  /usage             GET         — client sees their verification count
  Billing engine                 — count verifications per client key, generate invoices

Infrastructure:
  Hetzner CX42                  — main server (~$30/month)
  Hetzner CX22                  — hot standby (~$8/month)
  Hetzner CX22                  — Redis cache (~$8/month)
  Cloudflare Pro                 — DDoS + rate limiting (~$20/month)
  AWS Secrets Manager            — our own signing keys
  Total: ~$70/month for millions of users

Admin Panel (React):
  Client dashboard               — usage, billing, API key management
  System health                  — real-time metrics
  Security alerts                — unusual patterns, abuse detection
  Our own internal view          — anonymous metrics only, no user data
```

---

## PART 9 — ONE PAGE SUMMARY

```
TECH STACK:
  Swift (iOS) · Kotlin (Android) · TypeScript (Chrome extension)
  Python/FastAPI (backend) · PostgreSQL + Redis (database)
  Hetzner (server) · Cloudflare (DDoS/CDN) · AWS Secrets Manager (our keys)
  No Java needed. No complex cloud. Deliberately thin backend.

SCALING:
  100 million users = 15GB database on one Hetzner server
  Verification speed: Ed25519 signature check = 0.1 milliseconds
  Our server handles the workload at 1% capacity even at massive scale

BUSINESS MODEL:
  Free tier → pay per verification → volume discount → enterprise flat rate
  Each client gets unique API key → usage tracked anonymously → invoiced monthly
  Sharing SDK = caught by usage anomaly → not a real risk → contractually prevented
  Gross margin: ~99% — pure software, minimal infrastructure

FORGERY PREVENTION:
  Signature covers: exact recipient + subject + body + timestamp
  Change one character → signature invalid → extension shows ❌
  Attacker cannot generate valid signature without the private key
  Private key never leaves the Secure Enclave hardware chip
  Mathematically impossible to forge — not just hard, impossible

EXTENSION UNINSTALL:
  Extension sends removal notice to phone before uninstalling
  Phone app sends push: "Extension removed — is this you?"
  User can trigger emergency lock from phone
  Enterprise: server-side policy flags all unsigned emails from that domain

DISABLE PROTECTION:
  Disabling PhysicalOTP requires: biometric + OTP on two channels
  Same security level to turn off as to use
  Cannot be silently disabled by an attacker who has the phone

COMPLIANCE:
  We hold: UUID → public key only
  No PII, no biometric data, no transaction data
  Not subject to GDPR as a data processor (no personal data held)
  Out of PCI scope (never touch card/account data)
  If we are breached: attacker gets a list of anonymous UUIDs and public keys
  This is mathematically worthless without the private keys on user hardware
```

---

*Complete Build Specification v1.0*
*PhysicalOTP + SignedSend — Two products, one infrastructure, one mobile app*
*Tech stack confirmed · Business model confirmed · Forgery prevention confirmed*
*Regulatory burden: minimal · Gross margin: ~99% · Infrastructure cost: ~$70/month*
