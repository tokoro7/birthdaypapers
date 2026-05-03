import { hc } from 'hono/client';
import type { AppType } from '@birthdaypapers/api/src/index';

const baseUrl = import.meta.env.VITE_API_URL;
if (!baseUrl) {
  throw new Error('VITE_API_URL is not set');
}

export const client = hc<AppType>(baseUrl);
