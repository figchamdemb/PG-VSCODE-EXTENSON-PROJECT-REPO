# Tools & Commands

LAST_UPDATED_UTC: 2026-02-19 21:43
UPDATED_BY: mb-init
PROJECT_TYPE: frontend

## Purpose
Single source for local run commands, tool inventory, and environment versions.
Update this whenever runtime, dependencies, or service startup commands change.

## Runtime Versions
| Tool | Version | Where Used | Notes |
|---|---|---|---|
| Java | <e.g. 17/21> | backend | |
| Node.js | <e.g. 20> | frontend/tooling | |
| Python | <e.g. 3.11> | scripts | |
| Docker Desktop | <version> | local infra | |
| PostgreSQL | <version> | database | |

## Core Start Commands
### Project bootstrap
- Simple command (recommended):
  - `.\pg.ps1 start -Yes`
- End shift/session:
  - `.\pg.ps1 end -Note "finished for today"`
- Session status:
  - `.\pg.ps1 status`
- Start session (required before coding):
  - `powershell -ExecutionPolicy Bypass -File scripts/start_memory_bank_session.ps1`
- Build summary:
  - `python scripts/build_frontend_summary.py`
- Generate/update memory bank:
  - `python scripts/generate_memory_bank.py --profile frontend --keep-days 7`
- Install hooks:
  - `powershell -ExecutionPolicy Bypass -File scripts/install_memory_bank_hooks.ps1 -Mode warn`

### Backend examples (edit for repo)
- Start core service:
  - `./gradlew.bat bootRun` or `mvn spring-boot:run`
- Redis via docker:
  - `docker run --name redis-local -p 6379:6379 -d redis:7`
- Kafka via docker compose:
  - `docker compose up -d kafka zookeeper`

### Frontend examples (edit for repo)
- Install:
  - `npm install`
- Run dev:
  - `npm run dev`

### Mobile examples (edit for repo)
- Android debug build:
  - `./gradlew.bat assembleDebug`
- React Native metro:
  - `npm start`

## Tooling Inventory
| Capability | Tool | Enabled (Y/N) | Config Path |
|---|---|---|---|
| Cache | Redis | N | |
| Event streaming | Kafka | N | |
| Circuit breaker | Resilience4j | N | |
| Containerization | Docker | Y | |
| API gateway | <tool> | N | |

## Update Rules
- If `pom.xml`, `build.gradle*`, `package.json`, `docker-compose*`, workflow/runtime configs change, update this file in the same session.
- Do not store secrets or private tokens in command examples.