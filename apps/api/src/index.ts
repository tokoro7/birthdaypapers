import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { articlesApp } from './routes/articles';
import { digestApp } from './routes/digest';
import { turnstile } from './middlewares/turnstile';
import type { Bindings } from './bindings';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.use('/*', (c, next) =>
  cors({
    origin: (origin) => (origin === c.env.ALLOWED_ORIGIN ? origin : null),
  })(c, next),
);

app.use('/articles', turnstile);
app.use('/digest', turnstile);

const _routes = app.route('/', articlesApp).route('/', digestApp);

app.doc31('/doc', {
  openapi: '3.1.0',
  info: { title: 'Birthday Papers API', version: '0.0.1' },
});

app.get('/doc/ui', swaggerUI({ url: '/doc' }));

app.get('/', (c) => c.text('Hello Hono!'));

export default app;
export type AppType = typeof _routes;
