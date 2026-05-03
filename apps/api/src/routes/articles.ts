import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
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

const dayKey = (date: string) => `articles:nyt:${date}`;
const fetchingKey = (date: string) => `articles:nyt:${date.slice(0, 7)}:fetching`;

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

const enumerateDays = (year: number, month: number): string[] => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, i) =>
    `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  );
};

const PendingSchema = z
  .object({ status: z.literal('pending') })
  .openapi('Pending');

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
    202: {
      content: { 'application/json': { schema: PendingSchema } },
      description: 'キャッシュ準備中。少し待って再試行を',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'サーバ設定エラー',
    },
  },
  tags: ['Articles'],
  summary: '指定日の NYT 記事一覧を取得（キャッシュのみ）',
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

    const cached = await c.env.ARTICLES_KV.get<Article[]>(dayKey(date), 'json');
    if (cached) return c.json(cached, 200);

    const isFetching = await c.env.ARTICLES_KV.get(fetchingKey(date));
    if (isFetching) return c.json({ status: 'pending' as const }, 202);

    const apiKey = c.env.NYT_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'NYT_API_KEY is not configured' }, 500);
    }

    await c.env.ARTICLES_KV.put(fetchingKey(date), '1', { expirationTtl: 60 });

    c.executionCtx.waitUntil(
      (async () => {
        try {
          const [year, month] = date.split('-').map(Number);
          const url = new URL(
            `https://api.nytimes.com/svc/archive/v1/${year}/${month}.json`,
          );
          url.searchParams.set('api-key', apiKey);

          const res = await fetch(url.toString());
          if (!res.ok) return;

          const data = (await res.json()) as NytArchiveResponse;
          const byDay = splitByDay(data);
          const allDays = enumerateDays(year, month);
          await Promise.all(
            allDays.map((d) =>
              c.env.ARTICLES_KV.put(dayKey(d), JSON.stringify(byDay.get(d) ?? [])),
            ),
          );
        } finally {
          await c.env.ARTICLES_KV.delete(fetchingKey(date));
        }
      })(),
    );

    return c.json({ status: 'pending' as const }, 202);
  },
);
