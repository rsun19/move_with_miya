import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

config({ path: resolve(process.cwd(), '../.env') });

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.CLASSES_SERVICE_DATABASE_URL ?? env('DATABASE_URL'),
  },
});
