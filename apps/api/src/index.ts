import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Article } from '@birthdaypapers/shared';

type Bindings = {
  NYT_API_KEY: string;
  ALLOWED_ORIGIN: string;
};

type NytArchiveResponse = {
  response?: {
    docs?: Array<{
      _id?: string;
      web_url?: string;
      headline?: { main?: string };
      pub_date?: string;
    }>;
  };
};

const app = new Hono<{ Bindings: Bindings }>()
  .use('/*', (c, next) =>
    cors({
      origin: (origin) =>
        origin === c.env.ALLOWED_ORIGIN ? origin : null,
    })(c, next),
  )
  .get('/articles/:date', async (c) => {
    const date = c.req.param('date');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: 'date must be YYYY-MM-DD' }, 400);
    }

    const apiKey = c.env.NYT_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'NYT_API_KEY is not configured' }, 500);
    }

    const [year, month] = date.split('-');
    const url = new URL(
      `https://api.nytimes.com/svc/archive/v1/${year}/${Number(month)}.json`,
    );
    url.searchParams.set('api-key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      return c.json(
        { error: `NYT API error: ${res.status}`, detail: body.slice(0, 500) },
        502,
      );
    }

    const data = (await res.json()) as NytArchiveResponse;
    const docs = data.response?.docs ?? [];

    const articles: Article[] = docs
      .filter(
        (d) =>
          d._id &&
          d.web_url &&
          d.headline?.main &&
          d.pub_date?.slice(0, 10) === date,
      )
      .map((d) => ({
        id: d._id!,
        date: d.pub_date!.slice(0, 10),
        headline: d.headline!.main!,
        url: d.web_url!,
        source: 'NYT',
      }));

    return c.json(articles);
  });

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

export default app;
export type AppType = typeof app;
