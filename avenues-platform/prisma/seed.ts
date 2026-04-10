import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
  const adminHash = await bcrypt.hash("admin123", 12);
  const analystHash = await bcrypt.hash("admin123", 12);

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
  console.log("\nDemo accounts:");
  console.log("   Admin:   admin@avenues.clinic   / admin123");
  console.log("   Analyst: analyst@avenues.clinic  / admin123");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
