import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  type Article,
  ArticleListSchema,
  DateParamSchema,
  ErrorSchema,
} from '@birthdaypapers/shared';
import type { Bindings } from '../bindings';

type NytArchiveResponse = {
  response?: {
    docs?: Array<{
      _id?: string;
      web_url?: string;
      headline?: { main?: string };
      pub_date?: string;
      section_name?: string;
      type_of_material?: string;
    }>;
  };
};

const kvKey = (date: string) => `articles:nyt:${date}`;

const splitByDay = (data: NytArchiveResponse): Map<string, Article[]> => {
  const byDay = new Map<string, Article[]>();
  for (const d of data.response?.docs ?? []) {
    if (!d._id || !d.web_url || !d.headline?.main || !d.pub_date) continue;
    const date = d.pub_date.slice(0, 10);
    const article: Article = {
      id: d._id,
      date,
      headline: d.headline.main,
      url: d.web_url,
      source: 'NYT',
      section: d.section_name,
      type: d.type_of_material,
    };
    const list = byDay.get(date);
    if (list) list.push(article);
    else byDay.set(date, [article]);
  }
  return byDay;
};

const getArticlesByDateRoute = createRoute({
  method: 'get',
  path: '/articles',
  request: { query: DateParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: ArticleListSchema } },
      description: '指定日の NYT 記事一覧',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'date 形式が不正',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'サーバ設定エラー',
    },
    502: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'NYT API のエラー',
    },
  },
  tags: ['Articles'],
  summary: '指定日の NYT 記事一覧を取得',
});

export const articlesApp = new OpenAPIHono<{ Bindings: Bindings }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'Invalid request',
          detail: result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join(', '),
        },
        400,
      );
    }
  },
}).openapi(
  getArticlesByDateRoute,
  async (c) => {
    const { date } = c.req.valid('query');

    const cached = await c.env.ARTICLES_KV.get<Article[]>(kvKey(date), 'json');
    if (cached) {
      return c.json(cached, 200);
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
    const byDay = splitByDay(data);

    await Promise.all(
      [...byDay].map(([d, articles]) =>
        c.env.ARTICLES_KV.put(kvKey(d), JSON.stringify(articles)),
      ),
    );

    return c.json(byDay.get(date) ?? [], 200);
  },
);
