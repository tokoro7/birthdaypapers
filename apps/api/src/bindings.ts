import type { KVNamespace } from '@cloudflare/workers-types';

export type Bindings = {
  NYT_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
  ARTICLES_KV: KVNamespace;
};
