# DB Schema - auto-discovered-schema

LAST_UPDATED_UTC: 2026-03-28 22:31
UPDATED_BY: agent
PROFILE: frontend

## Purpose
Auto-generated schema map from repository migration/schema files (code artifacts only).

## Migration Source
- SQL/schema files scanned: 1
- Prisma schema files scanned: 1
- Latest migration/schema artifact: `server/prisma/migrations/0_init/migration.sql`

## Source Files (Sample)
- `server/prisma/migrations/0_init/migration.sql`
- `server/prisma/schema.prisma`

## Tables (Index)
| Table | Source | Create Statements | Alter Statements | Index References | Notes |
|---|---|---:|---:|---:|---|
| `adminaccount` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminAccount |
| `adminaccountrole` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminAccountRole |
| `adminauditlog` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminAuditLog |
| `adminpermission` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminPermission |
| `adminrole` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminRole |
| `adminrolepermission` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminRolePermission |
| `adminscope` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AdminScope |
| `affiliatecode` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AffiliateCode |
| `affiliateconversion` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AffiliateConversion |
| `affiliatepayout` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AffiliatePayout |
| `authchallenge` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: AuthChallenge |
| `device` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: Device |
| `oauthstate` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: OAuthState |
| `offlinepaymentref` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: OfflinePaymentRef |
| `productentitlement` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: ProductEntitlement |
| `projectactivation` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: ProjectActivation |
| `projectquota` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: ProjectQuota |
| `providerpolicy` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: ProviderPolicy |
| `redeemcode` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: RedeemCode |
| `refundrequest` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: RefundRequest |
| `serverkey` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: ServerKey |
| `session` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: Session |
| `stripeevent` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: StripeEvent |
| `subscription` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: Subscription |
| `team` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: Team |
| `teammembership` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: TeamMembership |
| `trial` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: Trial |
| `user` | `server/prisma/schema.prisma` | 0 | 0 | 0 | Prisma model: User |

## Tables (Columns)
### table: adminaccount
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminaccountrole
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminauditlog
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminpermission
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminrole
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminrolepermission
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: adminscope
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: affiliatecode
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: affiliateconversion
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: affiliatepayout
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: authchallenge
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: device
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: oauthstate
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: offlinepaymentref
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: productentitlement
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: projectactivation
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: projectquota
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: providerpolicy
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: redeemcode
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: refundrequest
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: serverkey
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: session
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: stripeevent
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: subscription
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: team
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: teammembership
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: trial
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |

### table: user
| column | type | constraints | description |
|---|---|---|---|
| _auto-scan_ | _n/a_ | _n/a_ | Parsed from migrations/schema artifacts; run DB-specific introspection if you need exact per-column typing. |
