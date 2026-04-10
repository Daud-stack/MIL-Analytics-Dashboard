import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  // Use the DIRECT (non-pooled) URL for migrations/db push.
  // For Neon, this is the URL without "-pooler" in the hostname.
  datasource: {
    url: env('DIRECT_URL'),
  },

  // Seed script for `npx prisma db seed`
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
