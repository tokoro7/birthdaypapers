import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../bindings';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type SiteverifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

export const turnstile = createMiddleware<{ Bindings: Bindings }>(
  async (c, next) => {
    const token = c.req.header('cf-turnstile-response');
    if (!token) {
      return c.json({ error: 'Turnstile verification failed' }, 403);
    }

    const secret = c.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      return c.json({ error: 'TURNSTILE_SECRET_KEY is not configured' }, 500);
    }

    let result: SiteverifyResponse;
    try {
      const body = new FormData();
      body.append('secret', secret);
      body.append('response', token);
      const res = await fetch(SITEVERIFY_URL, { method: 'POST', body });
      result = (await res.json()) as SiteverifyResponse;
    } catch {
      return c.json({ error: 'Turnstile siteverify unreachable' }, 503);
    }

    if (!result.success) {
      return c.json({ error: 'Turnstile verification failed' }, 403);
    }

    await next();
  },
);
