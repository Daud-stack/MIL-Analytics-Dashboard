/**
 * Backfill the normalized `episodes` table from existing year_data JSON blobs.
 *
 * Usage:
 *   npx tsx scripts/backfill-episodes.ts                 # append-only (idempotent)
 *   npx tsx scripts/backfill-episodes.ts --replace       # wipe + rebuild each year
 *   npx tsx scripts/backfill-episodes.ts --year 2026     # limit to one year
 *   npx tsx scripts/backfill-episodes.ts --org my-slug   # limit to one org slug
 *
 * Reads DATABASE_URL from .env (same as prisma seed). Run AFTER applying the
 * schema (npx prisma db push) and rotating your database credentials.
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { extractEpisodeRows, syncEpisodes } from '../src/lib/episodes';

interface Args {
  replace: boolean;
  year?: number;
  org?: string;
}

function parseArgs(): Args {
  const args: Args = { replace: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--replace') args.replace = true;
    else if (argv[i] === '--year') args.year = parseInt(argv[++i], 10);
    else if (argv[i] === '--org') args.org = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  console.log('Backfilling episodes table...', args);

  const orgs = await prisma.organization.findMany({
    where: args.org ? { slug: args.org } : undefined,
    select: { id: true, slug: true, name: true },
  });
  if (orgs.length === 0) {
    console.error('No organizations matched.');
    process.exit(1);
  }

  let totalInserted = 0;
  let totalDeleted = 0;

  for (const org of orgs) {
    const records = await prisma.yearDataRecord.findMany({
      where: {
        orgId: org.id,
        ...(args.year !== undefined && !Number.isNaN(args.year) ? { year: args.year } : {}),
      },
      select: { year: true, location: true },
    });

    for (const record of records) {
      const location = record.location as { rawRows?: Record<string, unknown>[] } | null;
      const rawRows = location?.rawRows;
      const rows = extractEpisodeRows(rawRows, org.id, record.year, null);

      if (rows.length === 0) {
        console.log(`  ${org.slug} ${record.year}: no extractable episode rows (rawRows: ${rawRows?.length ?? 0})`);
        continue;
      }

      const result = await syncEpisodes(rows, {
        replace: args.replace,
        orgId: org.id,
        year: record.year,
      });
      totalInserted += result.inserted;
      totalDeleted += result.deleted;
      console.log(
        `  ${org.slug} ${record.year}: extracted ${rows.length}, inserted ${result.inserted}` +
        (args.replace ? `, deleted ${result.deleted} old rows` : '')
      );
    }
  }

  console.log(`\nDone. Inserted ${totalInserted} episode rows` + (args.replace ? `, deleted ${totalDeleted}` : '') + '.');
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
