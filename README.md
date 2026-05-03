# Birthday Papers

指定した日付に発行された New York Times の記事一覧を表示する Web アプリ。

## Structure

pnpm workspace の monorepo。

- `apps/api` — Cloudflare Workers + Hono。NYT Archive API を叩いて KV にキャッシュ。
- `apps/web` — Vite + React のフロントエンド。
- `packages/shared` — フロント／バックエンドで共有する型・スキーマ。

## Development

```bash
pnpm install
pnpm --filter @birthdaypapers/api dev
pnpm --filter @birthdaypapers/web dev
```

## Credits

### 背景動画

`apps/web/public/videos/` に含まれる動画は [Pexels](https://www.pexels.com/) のフリー素材を使用しています。Pexels License に基づき、商用・非商用問わず利用可能です。
