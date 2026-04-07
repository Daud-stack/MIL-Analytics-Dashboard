import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: "avenues-clinic" },
    update: {},
    create: {
      name: "Avenues Clinic",
      slug: "avenues-clinic",
    },
  });

  console.log("✅ Organization created:", org.name);

  // Create demo admin user (password: admin123)
  // In production, use bcrypt to hash passwords
  const admin = await prisma.user.upsert({
    where: { email: "admin@avenues.clinic" },
    update: {},
    create: {
      email: "admin@avenues.clinic",
      name: "Admin User",
      password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu7mO", // admin123
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created:", admin.email);

  // Create demo analyst user
  const analyst = await prisma.user.upsert({
    where: { email: "analyst@avenues.clinic" },
    update: {},
    create: {
      email: "analyst@avenues.clinic",
      name: "Data Analyst",
      password: "$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu7mO", // admin123
      role: "ANALYST",
    },
  });

  console.log("✅ Analyst user created:", analyst.email);

  // Link users to organization
  await prisma.userOrganization.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    update: {},
    create: { userId: admin.id, orgId: org.id, role: "admin" },
  });

  await prisma.userOrganization.upsert({
    where: { userId_orgId: { userId: analyst.id, orgId: org.id } },
    update: {},
    create: { userId: analyst.id, orgId: org.id, role: "member" },
  });

  console.log("✅ Users linked to organization");
  console.log("\n🎉 Seeding complete!");
  console.log("\n📋 Demo accounts:");
  console.log("   Admin:   admin@avenues.clinic   / admin123");
  console.log("   Analyst: analyst@avenues.clinic  / admin123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
