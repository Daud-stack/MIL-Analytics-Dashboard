import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  // Use DIRECT_URL for migrations/db push (non-pooled Neon connection).
  // Falls back to DATABASE_URL for environments where only one is set (e.g. Vercel).
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },

  // Seed script for `npx prisma db seed`
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
