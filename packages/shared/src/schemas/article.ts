import { z } from '@hono/zod-openapi';

export const DateParamSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .openapi({
      param: { name: 'date', in: 'query' },
      example: '2000-01-30',
    }),
});

export const ArticleSchema = z
  .object({
    id: z.string().openapi({ example: 'nyt://article/abc123' }),
    date: z.string().openapi({ example: '2000-01-30' }),
    headline: z.string().openapi({ example: 'Markets Plunge as Investors Worry' }),
    url: z.string().url().openapi({ example: 'https://www.nytimes.com/2000/01/30/...' }),
    source: z.string().openapi({ example: 'NYT' }),
    section: z.string().optional().openapi({ example: 'Business Day' }),
    type: z.string().optional().openapi({ example: 'News' }),
  })
  .openapi('Article');

export const ArticleListSchema = z.array(ArticleSchema);

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: 'date must be YYYY-MM-DD' }),
    detail: z.string().optional(),
  })
  .openapi('Error');

export type Article = z.infer<typeof ArticleSchema>;
