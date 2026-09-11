// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://www.filtersfast.com',
  output: 'server',
  adapter: cloudflare({
    // Product/marketing images live in R2 and are resized by Cloudflare Images at request time.
    imageService: 'cloudflare-binding',
    // Astro Sessions are backed by the SESSION KV namespace declared in wrangler.jsonc.
    sessionKVBindingName: 'SESSION',
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Keep every drizzle-orm module in one chunk. Left to its own heuristics, rolldown moved
          // drizzle's `count` helper into the Better Auth chunk and had the drizzle chunk re-export it,
          // a cycle that evaluated the D1 schema before drizzle's Table class existed (500 on every page).
          codeSplitting: {
            groups: [{ name: 'drizzle-orm', test: /node_modules[\\/]drizzle-orm[\\/]/ }],
          },
        },
      },
    },
  },
  trailingSlash: 'ignore', // legacy URLs had trailing slashes; middleware 301s them to the canonical form
  security: {
    // Astro's built-in check is all-or-nothing and would 403 the server-to-server form posts under /api/
    // (Ordergroove, WMS) that carry no Origin header. Middleware applies the same CSRF rule to every other path.
    checkOrigin: false,
  },
  build: {
    format: 'file',
  },
});
