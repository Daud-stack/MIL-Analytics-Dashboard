/**
 * Create a per-org machine API key directly in the database — no HTTP,
 * no session cookie needed. Run from the avenues-platform folder:
 *
 *   npx tsx scripts/create-api-key.ts                       # key named "file-watcher", first org
 *   npx tsx scripts/create-api-key.ts "my key name"         # custom name
 *   npx tsx scripts/create-api-key.ts "my key" avenues-clinic   # specific org slug
 *
 * Prerequisite: the api_keys table must exist (npx prisma db push).
 * The raw key is printed ONCE — only its SHA-256 hash is stored.
 */

import 'dotenv/config';
import { randomBytes, createHash } from 'crypto';
import prisma from '../src/lib/prisma';

const name = process.argv[2] || 'file-watcher';
const orgSlug = process.argv[3];

async function main() {
  const org = orgSlug
    ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
    : await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!org) {
    const available = await prisma.organization.findMany({ select: { slug: true, name: true } });
    console.error(
      orgSlug
        ? `No organization found with slug "${orgSlug}".`
        : 'No organizations exist yet — run the seed or register a user first.'
    );
    if (available.length > 0) {
      console.error('Available orgs:', available.map((o) => `${o.slug} (${o.name})`).join(', '));
    }
    process.exit(1);
  }

  const rawKey = `ak_${randomBytes(24).toString('base64url')}`;
  const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex');

  await prisma.apiKey.create({
    data: { name, keyHash, orgId: org.id, createdBy: 'create-api-key-script' },
  });

  console.log(`\nAPI key "${name}" created for organization "${org.name}" (${org.slug}):\n`);
  console.log(`  ${rawKey}\n`);
  console.log('Store it NOW — only the hash is saved, it cannot be shown again.');
  console.log('Put it in .env.watcher as the X-API-Key value.');
}

main()
  .catch((e) => {
    console.error('Failed:', e instanceof Error ? e.message : e);
    console.error('\nIf the error mentions a missing "api_keys" table, run: npx prisma db push');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
