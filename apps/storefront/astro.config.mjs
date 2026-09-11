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
