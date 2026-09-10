import type { APIRoute } from 'astro';
import { getAuth } from '~/lib/auth';

/** Better Auth's JSON API (used by client-side calls and OAuth callbacks). Server-rendered forms go through Astro Actions. */
export const ALL: APIRoute = async (ctx) => getAuth().handler(ctx.request);
