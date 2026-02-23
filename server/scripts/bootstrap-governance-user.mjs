#!/usr/bin/env node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return String(process.argv[index + 1] ?? "").trim();
}

const email = (readArg("--email", process.env.TEST_USER_EMAIL || "") || "").toLowerCase();
const teamKey = (
  readArg("--team-key", process.env.TEST_TEAM_KEY || "TEAM-SOLO") || "TEAM-SOLO"
).toUpperCase();
const seatLimitRaw = Number(readArg("--seat-limit", "5"));
const yearsRaw = Number(readArg("--years", "1"));
const seatLimit = Number.isFinite(seatLimitRaw) ? Math.max(1, Math.floor(seatLimitRaw)) : 5;
const years = Number.isFinite(yearsRaw) ? Math.max(1, Math.floor(yearsRaw)) : 1;
const enableSlack = readArg("--enable-slack", "true").toLowerCase() !== "false";

if (!email) {
  console.error("Missing required argument: --email <user@example.com>");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found for email: ${email}`);
    process.exit(1);
  }

  const now = new Date();
  const endsAt = new Date(now);
  endsAt.setFullYear(endsAt.getFullYear() + years);
  const refundWindowEndsAt = new Date(now);
  refundWindowEndsAt.setDate(refundWindowEndsAt.getDate() + 7);

  const team = await prisma.team.upsert({
    where: { teamKey },
    update: {
      planId: "team",
      moduleScope: "bundle",
      seatLimit
    },
    create: {
      id: randomUUID(),
      teamKey,
      ownerUserId: user.id,
      planId: "team",
      moduleScope: "bundle",
      seatLimit,
      createdAt: now
    }
  });

  await prisma.teamMembership.upsert({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: user.id
      }
    },
    update: {
      role: "owner",
      status: "active",
      invitedEmail: email,
      revokedAt: null
    },
    create: {
      id: randomUUID(),
      teamId: team.id,
      userId: user.id,
      role: "owner",
      status: "active",
      invitedEmail: email,
      createdAt: now,
      revokedAt: null
    }
  });

  await prisma.subscription.updateMany({
    where: { userId: user.id, status: "active" },
    data: { status: "revoked", revokedAt: now }
  });

  await prisma.subscription.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      planId: "team",
      teamId: team.id,
      status: "active",
      startsAt: now,
      endsAt,
      revokedAt: null,
      refundWindowEndsAt,
      source: "manual",
      createdAt: now
    }
  });

  await prisma.productEntitlement.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      narrateEnabled: true,
      memorybankEnabled: true,
      bundleEnabled: true,
      startsAt: now,
      endsAt,
      status: "active",
      createdAt: now
    }
  });

  await prisma.$executeRawUnsafe(
    "DELETE FROM narate_enterprise.governance_settings WHERE scope_type=$1 AND scope_id=$2",
    "team",
    team.id
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO narate_enterprise.governance_settings (
      id, scope_type, scope_id, slack_enabled, slack_addon_active, slack_channel, vote_mode,
      max_debate_chars, retention_days, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz)`,
    randomUUID(),
    "team",
    team.id,
    enableSlack,
    enableSlack,
    null,
    "majority",
    4000,
    30,
    now.toISOString(),
    now.toISOString()
  );

  const summary = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { endsAt: "desc" },
    take: 3
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        team_key: team.teamKey,
        seat_limit: team.seatLimit,
        active_subscription_count: summary.filter((item) => item.status === "active").length,
        active_plan: summary.find((item) => item.status === "active")?.planId ?? "none",
        slack_addon_active: enableSlack
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
