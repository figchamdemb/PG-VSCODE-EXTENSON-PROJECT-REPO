# DEPENDENCY VERIFICATION ENFORCEMENT — Strict Agent Directive

**System Directive:** This is a **100% STRICT ENFORCEMENT**. The agent MUST NOT add, install, or recommend ANY package, library, or dependency without first verifying it against the official source. Violations are treated as **BLOCKER-level failures**.

---

## THE PROBLEM THIS SOLVES

AI agents have stale training data. They will:
- Add packages that were deprecated 2 years ago
- Use version 2.x when version 5.x is current
- Install packages with known critical vulnerabilities
- Import from paths that changed in newer versions
- Use APIs that were removed in the latest version
- Add redundant packages when the framework already includes the feature
- Mix incompatible versions (e.g., React 18 with a React 16 library)

**This document enforces a mandatory verification step before ANY dependency is added.**

---

## CORE RULE: THE VERIFICATION PROTOCOL

```
BEFORE adding ANY package, the agent MUST:

1. CHECK the official documentation URL (see registry below)
2. VERIFY the package is not deprecated
3. CONFIRM the latest stable version
4. CHECK compatibility with the project's framework version
5. VERIFY no known critical/high vulnerabilities
6. CONFIRM the package is actively maintained (updated within 12 months)
7. CHECK if the framework already provides this functionality natively

If ANY of these checks fail → DENY the package and suggest an alternative.
The agent MUST NOT proceed without completing this verification.
```

---

## OFFICIAL DOCUMENTATION REGISTRY

### JavaScript / TypeScript Ecosystem

| Framework / Library | Official Docs URL | Package Registry | Notes |
|---|---|---|---|
| **Node.js** | https://nodejs.org/docs/latest/api/ | — | Check LTS schedule: https://nodejs.org/en/about/previous-releases |
| **npm** | https://docs.npmjs.com/ | https://www.npmjs.com/ | Always check `npm info <package>` for latest version |
| **TypeScript** | https://www.typescriptlang.org/docs/ | https://www.npmjs.com/package/typescript | Check release notes for breaking changes |
| **Next.js** | https://nextjs.org/docs | https://www.npmjs.com/package/next | CRITICAL: App Router vs Pages Router — APIs differ completely |
| **React** | https://react.dev/ | https://www.npmjs.com/package/react | NOT reactjs.org (old). Check React 19 vs 18 differences |
| **React Native** | https://reactnative.dev/docs/getting-started | https://www.npmjs.com/package/react-native | Check New Architecture compatibility |
| **NestJS** | https://docs.nestjs.com/ | https://www.npmjs.com/package/@nestjs/core | Modules must match @nestjs/core version |
| **Express** | https://expressjs.com/en/5x/api.html | https://www.npmjs.com/package/express | v5 is latest — v4 patterns differ |
| **Prisma** | https://www.prisma.io/docs | https://www.npmjs.com/package/prisma | @prisma/client must match prisma version exactly |
| **Drizzle ORM** | https://orm.drizzle.team/docs/overview | https://www.npmjs.com/package/drizzle-orm | Growing alternative to Prisma |
| **Zod** | https://zod.dev/ | https://www.npmjs.com/package/zod | v3 is stable. Check v4 migration if relevant |
| **React Query** | https://tanstack.com/query/latest/docs | https://www.npmjs.com/package/@tanstack/react-query | NOT react-query (old package name — DEPRECATED) |
| **React Hook Form** | https://react-hook-form.com/get-started | https://www.npmjs.com/package/react-hook-form | |
| **Zustand** | https://docs.pmnd.rs/zustand/getting-started/introduction | https://www.npmjs.com/package/zustand | |
| **Redux Toolkit** | https://redux-toolkit.js.org/ | https://www.npmjs.com/package/@reduxjs/toolkit | NOT redux (bare) — always use toolkit |
| **Tailwind CSS** | https://tailwindcss.com/docs | https://www.npmjs.com/package/tailwindcss | v4 vs v3 have different configs |
| **shadcn/ui** | https://ui.shadcn.com/docs | — | NOT an npm package — it's a copy-paste component library |
| **Playwright** | https://playwright.dev/docs/intro | https://www.npmjs.com/package/@playwright/test | |
| **Vitest** | https://vitest.dev/guide/ | https://www.npmjs.com/package/vitest | |
| **Jest** | https://jestjs.io/docs/getting-started | https://www.npmjs.com/package/jest | |
| **Axios** | https://axios-http.com/docs/intro | https://www.npmjs.com/package/axios | Consider: native fetch() may be sufficient |
| **Socket.IO** | https://socket.io/docs/v4/ | https://www.npmjs.com/package/socket.io | Client + Server versions must match |
| **Stripe** | https://docs.stripe.com/libraries | https://www.npmjs.com/package/stripe | Always use latest for PCI compliance |
| **Auth.js (NextAuth)** | https://authjs.dev/getting-started | https://www.npmjs.com/package/next-auth | v5 is latest — v4 API is VERY different |
| **Clerk** | https://clerk.com/docs | https://www.npmjs.com/package/@clerk/nextjs | |
| **Supabase** | https://supabase.com/docs | https://www.npmjs.com/package/@supabase/supabase-js | |
| **Firebase** | https://firebase.google.com/docs | https://www.npmjs.com/package/firebase | Modular (v9+) vs Compat — use modular |
| **Mongoose** | https://mongoosejs.com/docs/ | https://www.npmjs.com/package/mongoose | |
| **Bull / BullMQ** | https://docs.bullmq.io/ | https://www.npmjs.com/package/bullmq | BullMQ is the successor — NOT bull |
| **Winston** | https://github.com/winstonjs/winston#readme | https://www.npmjs.com/package/winston | |
| **Pino** | https://getpino.io/ | https://www.npmjs.com/package/pino | Faster than Winston |
| **Helmet** | https://helmetjs.github.io/ | https://www.npmjs.com/package/helmet | |
| **Passport.js** | https://www.passportjs.org/docs/ | https://www.npmjs.com/package/passport | |
| **Resend** | https://resend.com/docs | https://www.npmjs.com/package/resend | Modern email — replaces Nodemailer for many uses |
| **Uploadthing** | https://docs.uploadthing.com/ | https://www.npmjs.com/package/uploadthing | |

### React Native Specific

| Library | Official Docs | NPM | Notes |
|---|---|---|---|
| **React Navigation** | https://reactnavigation.org/docs/getting-started | https://www.npmjs.com/package/@react-navigation/native | v7 is latest |
| **Expo** | https://docs.expo.dev/ | https://www.npmjs.com/package/expo | Check SDK version compatibility |
| **Reanimated** | https://docs.swmansion.com/react-native-reanimated/ | https://www.npmjs.com/package/react-native-reanimated | v3 is stable |
| **Gesture Handler** | https://docs.swmansion.com/react-native-gesture-handler/ | https://www.npmjs.com/package/react-native-gesture-handler | |
| **Flash List** | https://shopify.github.io/flash-list/ | https://www.npmjs.com/package/@shopify/flash-list | Replaces FlatList for performance |
| **MMKV** | https://github.com/mrousavy/react-native-mmkv | https://www.npmjs.com/package/react-native-mmkv | Faster than AsyncStorage |
| **Keychain** | https://github.com/oblador/react-native-keychain | https://www.npmjs.com/package/react-native-keychain | For secure token storage |

### Python Ecosystem

| Framework | Official Docs | Package Registry | Notes |
|---|---|---|---|
| **Python** | https://docs.python.org/3/ | https://pypi.org/ | Check version support: https://devguide.python.org/versions/ |
| **pip** | https://pip.pypa.io/en/stable/ | https://pypi.org/ | Always check `pip index versions <package>` |
| **FastAPI** | https://fastapi.tiangolo.com/ | https://pypi.org/project/fastapi/ | |
| **Django** | https://docs.djangoproject.com/stable/ | https://pypi.org/project/Django/ | Check LTS versions: https://www.djangoproject.com/download/ |
| **Django REST Framework** | https://www.django-rest-framework.org/ | https://pypi.org/project/djangorestframework/ | |
| **SQLAlchemy** | https://docs.sqlalchemy.org/en/20/ | https://pypi.org/project/SQLAlchemy/ | v2.0 vs v1.4 — major API differences |
| **Alembic** | https://alembic.sqlalchemy.org/en/latest/ | https://pypi.org/project/alembic/ | |
| **Pydantic** | https://docs.pydantic.dev/latest/ | https://pypi.org/project/pydantic/ | v2 vs v1 — breaking changes |
| **Celery** | https://docs.celeryq.dev/en/stable/ | https://pypi.org/project/celery/ | |
| **pytest** | https://docs.pytest.org/en/stable/ | https://pypi.org/project/pytest/ | |
| **httpx** | https://www.python-httpx.org/ | https://pypi.org/project/httpx/ | Async HTTP — modern replacement for requests |
| **bcrypt** | https://github.com/pyca/bcrypt | https://pypi.org/project/bcrypt/ | |
| **python-jose** | https://python-jose.readthedocs.io/ | https://pypi.org/project/python-jose/ | For JWT |
| **structlog** | https://www.structlog.org/en/stable/ | https://pypi.org/project/structlog/ | |

### Flutter / Dart Ecosystem

| Package | Official Docs | Registry | Notes |
|---|---|---|---|
| **Flutter** | https://docs.flutter.dev/ | https://pub.dev/ | Check version: https://docs.flutter.dev/release/archive |
| **Dart** | https://dart.dev/guides | https://pub.dev/ | |
| **BLoC** | https://bloclibrary.dev/ | https://pub.dev/packages/flutter_bloc | |
| **Riverpod** | https://riverpod.dev/docs/introduction/getting-started | https://pub.dev/packages/flutter_riverpod | v2 is stable |
| **GoRouter** | https://pub.dev/packages/go_router | https://pub.dev/packages/go_router | Official Flutter team package |
| **Dio** | https://pub.dev/packages/dio | https://pub.dev/packages/dio | HTTP client |
| **GetIt** | https://pub.dev/packages/get_it | https://pub.dev/packages/get_it | DI container |
| **Hive** | https://pub.dev/packages/hive | https://pub.dev/packages/hive | Local storage |
| **flutter_secure_storage** | https://pub.dev/packages/flutter_secure_storage | https://pub.dev/packages/flutter_secure_storage | For tokens |

### Kotlin / Android Ecosystem

| Library | Official Docs | Registry | Notes |
|---|---|---|---|
| **Kotlin** | https://kotlinlang.org/docs/home.html | — | |
| **Android Jetpack** | https://developer.android.com/jetpack | Maven Central | |
| **Jetpack Compose** | https://developer.android.com/develop/ui/compose/documentation | Maven Central | Check BOM version |
| **Hilt** | https://dagger.dev/hilt/ | Maven Central | |
| **Room** | https://developer.android.com/training/data-storage/room | Maven Central | |
| **Retrofit** | https://square.github.io/retrofit/ | Maven Central | |
| **OkHttp** | https://square.github.io/okhttp/ | Maven Central | |
| **Kotlin Coroutines** | https://kotlinlang.org/docs/coroutines-guide.html | Maven Central | |
| **Coil** | https://coil-kt.github.io/coil/ | Maven Central | Image loading |

### Java / Spring Ecosystem

| Framework | Official Docs | Registry | Notes |
|---|---|---|---|
| **Spring Boot** | https://docs.spring.io/spring-boot/reference/ | https://mvnrepository.com/ | Check version support: https://spring.io/projects/spring-boot#support |
| **Spring Security** | https://docs.spring.io/spring-security/reference/ | Maven Central | |
| **Spring Data JPA** | https://docs.spring.io/spring-data/jpa/reference/ | Maven Central | |
| **Flyway** | https://documentation.red-gate.com/fd | Maven Central | |
| **Liquibase** | https://docs.liquibase.com/ | Maven Central | |
| **Resilience4j** | https://resilience4j.readme.io/docs | Maven Central | |
| **MapStruct** | https://mapstruct.org/documentation/stable/reference/html/ | Maven Central | DTO mapping |

### Infrastructure & DevOps

| Tool | Official Docs | Notes |
|---|---|---|
| **Docker** | https://docs.docker.com/ | Check base image tags: https://hub.docker.com/ |
| **Kubernetes** | https://kubernetes.io/docs/ | |
| **Terraform** | https://developer.hashicorp.com/terraform/docs | |
| **Helm** | https://helm.sh/docs/ | |
| **GitHub Actions** | https://docs.github.com/en/actions | |
| **PostgreSQL** | https://www.postgresql.org/docs/current/ | |
| **Redis** | https://redis.io/docs/ | |
| **MongoDB** | https://www.mongodb.com/docs/ | |
| **Nginx** | https://nginx.org/en/docs/ | |

---

## KNOWN DEPRECATED PACKAGES — DENY LIST

The agent MUST NEVER install these. Always use the replacement:

| ❌ DEPRECATED | ✅ REPLACEMENT | Reason |
|---|---|---|
| `react-query` | `@tanstack/react-query` | Renamed. Old package abandoned |
| `react-scripts` | `vite` or `next` | Create React App is deprecated |
| `create-react-app` | `vite`, `next`, or `remix` | Officially deprecated by React team |
| `moment` | `date-fns` or `dayjs` or native `Intl` | Moment.js is in maintenance mode, huge bundle |
| `request` | `node-fetch`, `axios`, or native `fetch` | Deprecated since 2020 |
| `node-sass` | `sass` (dart-sass) | node-sass is deprecated |
| `tslint` | `eslint` + `@typescript-eslint` | TSLint deprecated since 2019 |
| `enzyme` | `@testing-library/react` | Enzyme not maintained for React 18+ |
| `redux` (bare) | `@reduxjs/toolkit` | Bare redux is not recommended |
| `formik` | `react-hook-form` | Formik is poorly maintained |
| `faker` | `@faker-js/faker` | Original faker was maliciously deleted |
| `colors` (npm) | `chalk` or `picocolors` | colors was maliciously corrupted |
| `uuid` v3 | `uuid` v9+ or `crypto.randomUUID()` | Use latest or native |
| `body-parser` | Express built-in `express.json()` | Built into Express since v4.16 |
| `multer` (old) | Check latest version or `busboy` | Ensure latest maintained version |
| `dotenv` (sometimes) | Built-in in Next.js, Vite, NestJS | Many frameworks load .env natively now |
| `AsyncStorage` (RN) | `@react-native-async-storage/async-storage` | Old path deprecated |
| `bull` | `bullmq` | BullMQ is the successor |
| `passport-local` (alone) | `passport-jwt` + `bcrypt` | Password auth needs JWT for APIs |
| `nodemailer` (for new) | `resend` or `sendgrid` | Consider modern alternatives first |
| `winston-daily-rotate-file` | Verify still maintained | Check last publish date |

---

## AGENT VERIFICATION WORKFLOW

```
WHEN the agent needs to add a dependency:

┌─────────────────────────────────────────────┐
│ 1. CHECK DENY LIST                          │
│    Is this package on the deprecated list?   │
│    YES → DENY. Suggest replacement.          │
│    NO  → Continue.                           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 2. CHECK IF NATIVE ALTERNATIVE EXISTS       │
│    Does the framework already provide this?  │
│    Examples:                                 │
│    - fetch() is native in Node 18+          │
│    - Express has built-in JSON parsing      │
│    - Next.js loads .env automatically       │
│    - crypto.randomUUID() replaces uuid pkg  │
│    YES → DENY package. Use native.          │
│    NO  → Continue.                           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 3. VERIFY ON OFFICIAL REGISTRY              │
│    Go to npm/PyPI/pub.dev/Maven Central     │
│    CHECK:                                    │
│    - Latest stable version number           │
│    - Last publish date (< 12 months ago?)   │
│    - Weekly downloads (active community?)   │
│    - Deprecated flag (npm shows this)       │
│    FAILED → DENY. Find alternative.         │
│    PASSED → Continue.                        │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 4. CHECK OFFICIAL DOCUMENTATION             │
│    Go to the doc URL from the registry above│
│    VERIFY:                                   │
│    - Installation command matches latest    │
│    - Import paths are current               │
│    - API being used still exists            │
│    - Compatible with project's framework    │
│    FAILED → DENY. Use correct version/API.  │
│    PASSED → Continue.                        │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 5. VERSION COMPATIBILITY CHECK              │
│    Is this version compatible with:          │
│    - Node.js version in project?            │
│    - React/Next.js/framework version?       │
│    - Other dependencies in package.json?    │
│    - Peer dependencies satisfied?           │
│    CONFLICT → DENY. Resolve conflict first. │
│    COMPATIBLE → APPROVE installation.        │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│ 6. INSTALL WITH EXACT OR CARET VERSION      │
│    Use: npm install package@^major.minor    │
│    Pin major version, allow patches.        │
│    NEVER: npm install package (no version)  │
│    NEVER: npm install package@latest        │
│    (both can pull unstable/breaking changes)│
└─────────────────────────────────────────────┘
```

---

## STRICT RULES

### ✅ MUST DO:
- **MUST** check the official package registry before adding any dependency
- **MUST** verify the package was updated within the last 12 months
- **MUST** use the latest STABLE version (not alpha, beta, rc, canary, next)
- **MUST** verify peer dependency compatibility with the project
- **MUST** check if the framework provides native functionality before adding a package
- **MUST** use `^` (caret) version pinning for stability: `"package": "^5.2.0"`
- **MUST** verify the import path matches the current version's documentation
- **MUST** run `npm audit` (or equivalent) after adding dependencies and fix critical/high vulnerabilities
- **MUST** check changelogs when upgrading major versions for breaking changes
- **MUST** prefer packages maintained by the framework team or major organizations

### ❌ MUST NOT DO (DENY):
- **DENY** installing any package from the deprecated deny list above
- **DENY** adding a package without checking the official registry for latest version
- **DENY** using version numbers from memory — always verify against the registry
- **DENY** installing alpha/beta/rc/canary versions unless explicitly requested by the user
- **DENY** `npm install package` without specifying a version range
- **DENY** adding packages that duplicate framework-native functionality
- **DENY** adding packages last published > 24 months ago without documented justification
- **DENY** ignoring peer dependency warnings during installation
- **DENY** using old import paths (e.g., `react-query` instead of `@tanstack/react-query`)
- **DENY** adding > 3 new dependencies in a single operation without user approval
- **DENY** adding packages with known critical vulnerabilities (npm audit)
- **DENY** using a package's deprecated API when a replacement exists in the current version

---

## VERSION COMPATIBILITY MATRIX

The agent must verify these framework + dependency compatibilities:

### Next.js
```
Next.js 15 → React 19, Node 18.18+
Next.js 14 → React 18, Node 18.17+
Next.js 13 → React 18, Node 16.14+

Auth.js v5 → Next.js 14+
NextAuth v4 → Next.js 12-14 (v4 API is completely different from v5)
```

### React Native
```
React Native 0.76+ → React 18.3+, New Architecture default
React Native 0.73+ → React 18.2+
React Navigation v7 → React Native 0.73+
React Navigation v6 → React Native 0.63+

Reanimated v3 → React Native 0.71+
```

### NestJS
```
@nestjs/* packages MUST all be the same major version.
NestJS 10 → Node 16+, TypeScript 4.7+
NestJS 11 → Node 18+, TypeScript 5.0+
```

### Prisma
```
@prisma/client version MUST exactly match prisma CLI version.
Prisma 5 → Node 16.13+
Prisma 6 → Node 18.18+
```

### Spring Boot
```
Spring Boot 3.x → Java 17+, Jakarta EE (javax → jakarta namespace change)
Spring Boot 2.x → Java 8+, Java EE (javax namespace)
DO NOT mix Spring Boot 2 and 3 dependencies
```

---

## EXAMPLE: WHAT THE AGENT SHOULD DO

```
User: "Add authentication to my Next.js app"

WRONG (what agents typically do):
npm install next-auth     ← Old v4 package name, may pull wrong version
npm install bcrypt        ← Fine but check version
npm install jsonwebtoken  ← May not be needed with Auth.js

CORRECT (what the agent MUST do):
1. Check: User has Next.js 14. Auth.js v5 supports Next.js 14+. ✅
2. Check: https://authjs.dev/getting-started — latest install command
3. Verify: npm info next-auth — latest is v5.x
4. Install: npm install next-auth@^5.0.0 @auth/prisma-adapter@^2.0.0
5. Use import paths from v5 docs (different from v4!)
6. Verify: no npm audit vulnerabilities
```

---

## QUICK REFERENCE: VERIFICATION COMMANDS

```bash
# npm — Check package info
npm info <package> version           # Latest version
npm info <package> time              # All publish dates
npm info <package> deprecated        # Check if deprecated
npm view <package> peerDependencies  # Check peer deps
npm audit                            # Vulnerability scan

# pip — Check package info
pip index versions <package>         # All available versions
pip show <package>                   # Installed version info
pip audit                            # Vulnerability scan (pip-audit)

# pub.dev (Flutter/Dart)
# Check https://pub.dev/packages/<package>/versions

# Maven (Java/Kotlin)
# Check https://mvnrepository.com/artifact/<group>/<artifact>
```

---

## ENFORCEMENT SUMMARY

This document exists because dependency mistakes are the #1 source of:
1. **Security vulnerabilities** (outdated packages with known CVEs)
2. **Build failures** (incompatible versions)
3. **Runtime errors** (deprecated APIs that were removed)
4. **Bundle bloat** (using a 500KB package when a 5KB alternative or native feature exists)
5. **Technical debt** (locked to old versions because the agent picked an unmaintained package)

**The agent treats this verification step as non-negotiable. No package is added without verification. No exceptions.**
