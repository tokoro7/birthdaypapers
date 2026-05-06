import Anthropic from '@anthropic-ai/sdk';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import {
  DigestRequestSchema,
  DigestResponseSchema,
  ErrorSchema,
} from '@birthdaypapers/shared';
import type { Bindings } from '../bindings';

const PICK_COUNT = 4;
const MODEL = 'claude-haiku-4-5';

const digestRoute = createRoute({
  method: 'post',
  path: '/digest',
  request: {
    body: {
      content: {
        'application/json': { schema: DigestRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DigestResponseSchema } },
      description: '見出し一覧の要約とピック',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'リクエスト形式が不正',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'サーバ設定エラー',
    },
    502: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: '要約生成に失敗',
    },
  },
  tags: ['Digest'],
  summary: '見出し一覧から要約とピックを生成',
});

const buildSystemPrompt = (lang: 'ja' | 'en'): string => {
  const langName = lang === 'ja' ? 'Japanese' : 'English';
  return [
    `You are a news editor. Given a list of news headlines from a single day, do the following:`,
    `1. Write one short ${langName} summary of the day's main topics in 1-2 sentences.`,
    `2. Pick the ${PICK_COUNT} most important or representative headlines and write a 1-sentence ${langName} summary for each.`,
    `Use each headline's "id" verbatim in your picks. Do not invent ids.`,
    `If the input list is empty, return an empty summary string and an empty picks array.`,
    `Return your output by calling the submit_digest tool.`,
  ].join('\n');
};

export const digestApp = new OpenAPIHono<{ Bindings: Bindings }>({
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
}).openapi(digestRoute, async (c) => {
  const { articles, lang = 'ja' } = c.req.valid('json');

  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500);
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(lang),
      tools: [
        {
          name: 'submit_digest',
          description: 'Submit the day digest summary and picks.',
          input_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              picks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    summary: { type: 'string' },
                  },
                  required: ['id', 'summary'],
                },
              },
            },
            required: ['summary', 'picks'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_digest' },
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ articles }),
        },
      ],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      return c.json({ error: 'Model did not return a tool_use block' }, 502);
    }

    const validated = DigestResponseSchema.parse(toolUse.input);
    return c.json(validated, 200);
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      return c.json(
        {
          error: 'Anthropic API error',
          detail: `${e.status}: ${e.message}`,
        },
        502,
      );
    }
    return c.json(
      {
        error: 'Digest generation failed',
        detail: e instanceof Error ? e.message : String(e),
      },
      502,
    );
  }
});
