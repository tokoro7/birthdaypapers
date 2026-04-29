import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Article } from '@birthdaypapers/shared';

const app = new Hono()
  .use('/*', cors())
  .get('/articles/:date', (c) => {
    const date = c.req.param('date');
    const articles: Article[] = [
      {
        id: '1',
        date,
        headline: 'Sample headline',
        url: 'https://example.com',
        source: 'NYT',
      },
    ];
    return c.json(articles);
  });

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app;
export type AppType = typeof app;