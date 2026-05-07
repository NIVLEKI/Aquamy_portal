// prisma/seed.ts
// Run with: npx prisma db seed
// package.json → "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AQUAMY database...");

  // ── 1. System Configuration ───────────────────────────────────────────────
  const configs = [
    { key: "REGISTRATION_FEE_KES",     value: "250",  description: "One-time non-refundable registration fee (KES)" },
    { key: "MAINTENANCE_FEE_KES",      value: "500",  description: "One-time maintenance fee paid on joining (KES)" },
    { key: "MONTHLY_CONTRIBUTION_KES", value: "500",  description: "Monthly contribution per member (KES)" },
    { key: "LATE_PENALTY_KES",         value: "100",  description: "Penalty per overdue monthly contribution (KES)" },
    { key: "FINE_LATENESS_KES",        value: "50",   description: "Fine for arriving late to a meeting (KES)" },
    { key: "FINE_ABSENT_APOLOGY_KES",  value: "20",   description: "Fine for absence with written apology (KES)" },
    { key: "SHARE_PRICE_KES",          value: "100",  description: "Current share price — update at AGM (KES)" },
    { key: "MEMBERSHIP_AGE_LIMIT",     value: "35",   description: "Maximum age for majority membership (years)" },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where:  { key: config.key },
      update: { value: config.value, description: config.description, updatedBy: "SEED" },
      create: { ...config, updatedBy: "SEED" },
    });
  }
  console.log(`  ✓ ${configs.length} system config entries upserted`);

  // ── 2. Initial Loan Policy ────────────────────────────────────────────────
  const existingPolicy = await prisma.loanPolicy.findFirst({ where: { active: true } });
  if (!existingPolicy) {
    await prisma.loanPolicy.create({
      data: {
        interestRate:          10.0,
        interestMethod:        "FLAT",
        maxDuration:           12,
        minDuration:           1,
        minimumLoanAmount:     1000,
        maximumLoanAmount:     50000,
        minimumMonthsAsMember: 3,
        requiredGuarantors:    2,
        active:                true,
        updatedBy:             "SEED",
      },
    });
    console.log("  ✓ Initial loan policy created (10% flat, max 12 months)");
  } else {
    console.log("  — Loan policy already exists, skipping");
  }

  // ── 3. Admin User ─────────────────────────────────────────────────────────
  // Credentials are hardcoded here — no env var override so they are reliable.
  const ADMIN_EMAIL    = "admin@aquamy.com";
  const ADMIN_PASSWORD = "R3dd1ngt0n4816#";

  // Delete any old admin with the legacy email so we don't get duplicate conflicts
  await prisma.user.deleteMany({
    where: { email: { in: ["admin@aquamy.co.ke"] } },
  });

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: {
      password: hashed,      // re-hash in case this is a credential reset run
      role:     "ADMIN",
      status:   "ACTIVE",
      isActive: true,
    },
    create: {
      memberNumber: "AQUAMY-0000",
      name:         "System Administrator",
      firstName:    "System",
      lastName:     "Administrator",
      email:        ADMIN_EMAIL,
      phone:        "0700000000",
      dateOfBirth:  new Date("1990-01-01"),
      password:     hashed,
      role:         "ADMIN",
      status:       "ACTIVE",
      isActive:     true,
    },
  });

  // Seed the admin's MemberFinancialSummary and Share rows so the
  // dashboard doesn't hit the cold-start fallback path for admin.
  const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (adminUser) {
    await prisma.memberFinancialSummary.upsert({
      where:  { userId: adminUser.id },
      create: { userId: adminUser.id },
      update: {},
    });
    await prisma.share.upsert({
      where:  { userId: adminUser.id },
      create: { userId: adminUser.id, quantity: 0, totalValue: 0 },
      update: {},
    });
  }

  console.log(`  ✓ Admin user ready`);
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });