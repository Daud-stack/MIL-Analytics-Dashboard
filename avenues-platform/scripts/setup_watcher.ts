import 'dotenv/config';
import prisma from "../src/lib/prisma";
import { generateApiKey, sha256Hex } from "../src/lib/security";
import fs from "fs";
import path from "path";

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("No Organization found in DB!");
    return;
  }

  const rawKey = generateApiKey();
  const keyHash = sha256Hex(rawKey);

  // Revoke old watcher keys and create new active watcher key
  await prisma.apiKey.deleteMany({
    where: { name: "Automated File Watcher" },
  });

  await prisma.apiKey.create({
    data: {
      name: "Automated File Watcher",
      keyHash,
      orgId: org.id,
    },
  });

  const watchDir = path.resolve(process.cwd(), "../Trimed Reports");
  const archiveDir = path.resolve(process.cwd(), "../Trimed Reports/Archived");
  if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true });
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const watcherEnv = `API_URL=http://localhost:3000
INGEST_API_KEY=${rawKey}
ORG_ID=${org.id}
WATCH_DIR=${watchDir}
ARCHIVE_DIR=${archiveDir}
POLL_MS=3000
`;

  fs.writeFileSync(path.resolve(process.cwd(), ".env.watcher"), watcherEnv);
  console.log("=================================================");
  console.log("✅ AUTOMATED FILE WATCHER CONFIGURED SUCCESSFULLY");
  console.log("=================================================");
  console.log("Org ID:         ", org.id);
  console.log("API Key:        ", rawKey);
  console.log("Watch Directory:", watchDir);
  console.log("Archive Folder: ", archiveDir);
  console.log("=================================================");
}

main().catch(console.error);
