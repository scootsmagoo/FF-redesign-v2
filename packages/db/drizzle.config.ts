import { defineConfig } from 'drizzle-kit';

// Migrations are generated here and applied with `wrangler d1 migrations apply`
// from apps/storefront (wrangler.jsonc points migrations_dir at ./migrations).
export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
