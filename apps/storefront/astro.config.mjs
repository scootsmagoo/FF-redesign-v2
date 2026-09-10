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
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
