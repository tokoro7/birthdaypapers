# API アクセス制限（Turnstile 導入）計画

公開 Web フロントエンド以外から API を直接叩かれることを抑止するため、Cloudflare Turnstile を導入する。

## 現状

- API: `https://birthdaypapers-api.tokoro7.workers.dev`（Cloudflare Workers）
- Web: `https://birthdaypapers.pages.dev`（Cloudflare Pages）
- 保護機構は `apps/api/src/index.ts` の CORS のみ。`ALLOWED_ORIGIN` と一致する `Origin` ヘッダ以外を拒否する。
- CORS はブラウザの自主規制であり、curl / スクリプトからの直アクセスには無力。API URL が漏れた瞬間に `/articles` `/digest` を叩き放題になる。

## 目的と非目標

- **目的**: 一般的な curl / スクリプトによる直叩きを実用的に弾く。NYT・Anthropic の従量コストを保護する。
- **非目標**: 完全な不正利用防止。ヘッドレスブラウザによるトークン取得自動化までは Turnstile の bot detection 任せ（必要なら Rate Limiting を後段で追加）。

## 採用方針

Cloudflare Turnstile（invisible モード）を Web フロントに埋め込み、API 側でトークンを検証する。

### 動作フロー

1. Web 起動時に Turnstile widget を invisible モードで実行し、トークンを取得する（短期間で失効するため、API 呼び出し直前に都度発行する設計）。
2. Web は API リクエストに `cf-turnstile-response` ヘッダ（or リクエストボディ）を載せる。
3. API は受信したトークンを `https://challenges.cloudflare.com/turnstile/v0/siteverify` に POST し、`success: true` を確認したうえで本処理に進む。失敗時は 403 を返す。
4. Turnstile sitekey 側で **Allowed hostnames** を本番 / プレビュー Pages ドメインに限定する。これにより sitekey を流用したトークン横取り発行を防ぐ。

### 設計の論点

#### 1. 適用範囲

| 経路            | 適用 | 備考                                     |
| --------------- | ---- | ---------------------------------------- |
| `GET /articles` | あり | NYT Archive 取得トリガになるため保護対象 |
| `POST /digest`  | あり | Anthropic 課金が直接発生するため最重要   |
| `GET /`         | なし | ヘルスチェック相当                       |
| `GET /doc`      | なし | OpenAPI スキーマ。公開で問題なし         |
| `GET /doc/ui`   | なし | Swagger UI。`/doc` を読むだけ            |

実装は Hono の middleware として `articlesApp` と `digestApp` に共通適用する。`/`, `/doc`, `/doc/ui` には掛けない。

#### 2. トークンの取得タイミング

候補:

- **A. API 呼び出し直前に都度 `turnstile.execute()`**
  - トークン失効（〜5分）と single-use 制約を素直にクリアできる。
  - 採用。
- **B. アプリ起動時に一度だけ取得して使い回す**
  - single-use のため二度目の API 呼び出しで失敗する。不可。

**採用**: A。`apps/web/src/api.ts` で fetch 直前に `window.turnstile.execute()` を await し、ヘッダに載せる。

#### 3. 検証 API の呼び出し位置（API 側）

候補:

- **A. middleware として `articlesApp` / `digestApp` に `use` で前置**
  - 各ルートのハンドラからは関心を切り離せる。
  - 採用。
- **B. 各ハンドラ冒頭で個別に呼ぶ**
  - 重複が出る。

**採用**: A。`apps/api/src/middlewares/turnstile.ts`（新規）に切り出し、両 sub-app の前段に挟む。

#### 4. 失敗時のレスポンス

- トークン未付与 / 検証失敗: `403 { error: 'Turnstile verification failed' }`
- siteverify 自体の通信失敗: `503 { error: 'Turnstile siteverify unreachable' }`（Cloudflare 障害時の暫定対応。検討）

#### 5. ローカル開発

- Turnstile には **テスト用 sitekey / secret** が公式に用意されている（常に成功 / 常に失敗 / 常にチャレンジ）。`.dev.vars` と `.env.development` にはこれを入れる。
- 本番値は GitHub Secrets / Cloudflare Dashboard 側にのみ置く。リポジトリは public のため、`docs/authentication.md` 含めて本番 sitekey を書かない。

参考（テスト鍵は Cloudflare 公式ドキュメントに掲載されているもの。実装時に Dashboard / docs から最新値を確認する）。

## バインディング・環境変数

新規追加:

- API (`apps/api/src/bindings.ts`): `TURNSTILE_SECRET_KEY`（**secret**、`wrangler secret put` 経由）
- Web (`apps/web/.env.*`): `VITE_TURNSTILE_SITE_KEY`（公開可、ただしリポジトリには直書きしない）

`apps/api/.dev.vars` と `apps/web/.env.development` に **テスト鍵** を記載してローカルで動かす。両ファイルは既に gitignore 済み。

GitHub Actions:

- `deploy-api.yml`: 本番 secret は事前に `wrangler secret put TURNSTILE_SECRET_KEY` で投入済みとする（CI からは触らない）。
- Web ビルド時に `VITE_TURNSTILE_SITE_KEY` を Repository Variable から注入。

## 実装手順

1. Cloudflare Dashboard で Turnstile widget を作成。
   - Mode: Invisible
   - Allowed hostnames: `birthdaypapers.pages.dev`, （プレビュードメイン）, `localhost`
   - Sitekey と Secret key を控える（後者は GitHub / Cloudflare 側のみに保存）。
2. API 側:
   1. `apps/api/src/bindings.ts` に `TURNSTILE_SECRET_KEY: string` を追加。
   2. `apps/api/src/middlewares/turnstile.ts` を新規作成。`cf-turnstile-response` ヘッダを取り出し、`siteverify` を叩いて成否を判定する Hono middleware を export。
   3. `apps/api/src/index.ts` で `articlesApp` / `digestApp` をマウントする箇所、または各 sub-app 内で middleware を `use` する。CORS の後段。
   4. `apps/api/.dev.vars` にテスト用 secret を追記。
   5. 本番には `wrangler secret put TURNSTILE_SECRET_KEY` で投入。
3. Web 側:
   1. `index.html` に Turnstile loader script (`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`) を追加。
   2. `apps/web/src/api.ts`（または専用フック）で sitekey を読み、`window.turnstile.execute()` でトークンを取得するヘルパを追加。
   3. `client.articles.$get` / `client.digest.$post` 呼び出しを、ヘッダに `cf-turnstile-response` を載せるよう改修。Hono RPC client の `init`（第二引数）で `headers` を渡す。
   4. `apps/web/.env.development` にテスト用 sitekey を追記、`.env.production` の扱いは GitHub Actions 側で注入。
4. CI / デプロイ:
   1. GitHub Repository Variables に `VITE_TURNSTILE_SITE_KEY`（本番値）を登録。
   2. `deploy-web.yml` のビルドステップで `VITE_TURNSTILE_SITE_KEY` を env に渡す。
   3. ci.yml のビルドにはテスト用 sitekey を直書き or Variables から注入（ビルドが通れば良い）。
5. ドキュメント:
   1. `CLAUDE.md` の「Bindings & env」節に `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` を追記。
   2. README があれば運用手順を追記。

## 残課題 / 後続検討

- siteverify が落ちたときの fail-open / fail-closed 方針。デフォルトは fail-closed（503）想定。
- `/digest` への Cloudflare Rate Limiting 追加（Turnstile を突破された場合の最終防衛線）。
- API の OpenAPI スキーマに 403 レスポンスを追記するか。
