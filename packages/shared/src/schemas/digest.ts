import { z } from '@hono/zod-openapi';

export const DigestLangSchema = z.enum(['ja', 'en']).openapi({ example: 'ja' });

export const DigestArticleInputSchema = z
  .object({
    id: z.string().openapi({ example: 'nyt://article/abc123' }),
    headline: z
      .string()
      .openapi({ example: 'Markets Plunge as Investors Worry' }),
    section: z.string().optional().openapi({ example: 'Business Day' }),
  })
  .openapi('DigestArticleInput');

export const DigestRequestSchema = z
  .object({
    articles: z.array(DigestArticleInputSchema),
    lang: DigestLangSchema.optional(),
  })
  .openapi('DigestRequest');

export const DigestPickSchema = z
  .object({
    id: z.string().openapi({ example: 'nyt://article/abc123' }),
    summary: z
      .string()
      .openapi({ example: '株価が急落。投資家は景気後退を懸念。' }),
  })
  .openapi('DigestPick');

export const DigestResponseSchema = z
  .object({
    summary: z.string().openapi({
      example: '市場の急落と政治の動きが目立った一日。',
    }),
    picks: z.array(DigestPickSchema),
  })
  .openapi('DigestResponse');

export type DigestLang = z.infer<typeof DigestLangSchema>;
export type DigestArticleInput = z.infer<typeof DigestArticleInputSchema>;
export type DigestRequest = z.infer<typeof DigestRequestSchema>;
export type DigestPick = z.infer<typeof DigestPickSchema>;
export type DigestResponse = z.infer<typeof DigestResponseSchema>;
