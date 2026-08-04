import "dotenv/config";
import { randomBytes } from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed passwords are taken from SEED_ADMIN_PASSWORD / SEED_ANALYST_PASSWORD
 * env vars, or randomly generated and printed ONCE. The previous fixed
 * password ("admin123") was also documented in the README - a guessable
 * admin credential if the seed ever ran against a live database.
 */
function resolvePassword(envVar: string): { password: string; generated: boolean } {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.length >= 12) return { password: fromEnv, generated: false };
  return { password: randomBytes(12).toString("base64url"), generated: true };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "avenues-clinic" },
    update: {},
    create: {
      name: "Avenues Clinic",
      slug: "avenues-clinic",
    },
  });

  console.log("Organization created:", org.name);

  // Hash passwords
  const adminPw = resolvePassword("SEED_ADMIN_PASSWORD");
  const analystPw = resolvePassword("SEED_ANALYST_PASSWORD");
  const adminHash = await bcrypt.hash(adminPw.password, 12);
  const analystHash = await bcrypt.hash(analystPw.password, 12);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@avenues.clinic" },
    update: { password: adminHash, orgId: org.id },
    create: {
      email: "admin@avenues.clinic",
      name: "Admin User",
      password: adminHash,
      role: "ADMIN",
      orgId: org.id,
    },
  });

  console.log("Admin user created:", admin.email);

  // Create analyst user
  const analyst = await prisma.user.upsert({
    where: { email: "analyst@avenues.clinic" },
    update: { password: analystHash, orgId: org.id },
    create: {
      email: "analyst@avenues.clinic",
      name: "Data Analyst",
      password: analystHash,
      role: "ANALYST",
      orgId: org.id,
    },
  });

  console.log("Analyst user created:", analyst.email);

  console.log("\nSeeding complete!");
  console.log("\nDemo accounts (store these now - they are not shown again):");
  console.log(`   Admin:   admin@avenues.clinic   / ${adminPw.generated ? adminPw.password + "  (generated)" : "<from SEED_ADMIN_PASSWORD>"}`);
  console.log(`   Analyst: analyst@avenues.clinic  / ${analystPw.generated ? analystPw.password + "  (generated)" : "<from SEED_ANALYST_PASSWORD>"}`);
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
