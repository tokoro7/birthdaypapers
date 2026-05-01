import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
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
    }>;
  };
};

const getArticlesByDateRoute = createRoute({
  method: 'get',
  path: '/articles/{date}',
  request: { params: DateParamSchema },
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
    const { date } = c.req.valid('param');

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

    const articles = docs
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

    return c.json(articles, 200);
  },
);
