import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminHash = await bcrypt.hash("AdminPassword123!", 12);
  const analystHash = await bcrypt.hash("AnalystPassword123!", 12);

  await prisma.user.update({
    where: { email: "admin@avenues.clinic" },
    data: { password: adminHash },
  });

  await prisma.user.update({
    where: { email: "analyst@avenues.clinic" },
    data: { password: analystHash },
  });

  console.log("SUCCESS: Demo passwords updated successfully!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
