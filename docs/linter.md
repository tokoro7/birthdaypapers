# Linter

このプロジェクトにおける ESLint の構成と運用ルール。

## 採用ツール

- **ESLint v10** (flat config)
- **typescript-eslint v8** — TypeScript 用パーサ + 推奨ルール
- **eslint-plugin-react-hooks v7** — `apps/web` の React Hooks ルール
- **eslint-plugin-react-refresh** — Vite + React Refresh 互換チェック
- **globals** — 環境別グローバル変数定義

これらは全てルートの `devDependencies` に集約。各 workspace 個別には入れない。

## 設定ファイル

- `eslint.config.js` — プロジェクトルート唯一の設定。flat config 形式。
- 各 workspace (`apps/web`, `apps/api`, `packages/shared`) には ESLint 設定ファイルを置かない。

## 環境別 override

flat config の配列順で、後ろの設定が前を上書きする。

| 対象 | 適用される設定 | グローバル |
|---|---|---|
| `**/*.{ts,tsx}` (土台) | `js.configs.recommended` + `tseslint.configs.recommended` | なし |
| `apps/web/**/*.{ts,tsx}` | + React Hooks 推奨 + React Refresh (vite) | `globals.browser` |
| `apps/api/**/*.ts` | (土台のみ) | `globals.worker` (Cloudflare Workers) |
| `packages/shared/**/*.ts` | (土台のみ) | なし (環境非依存) |

## ルール調整

- `@typescript-eslint/no-unused-vars`
  - `argsIgnorePattern: '^_'`
  - `varsIgnorePattern: '^_'`
  - `caughtErrorsIgnorePattern: '^_'`

`_` プレフィックスの未使用変数は許容する。Hono RPC で `AppType = typeof _routes` のように、値としては使わないが型として参照したい変数があるため。

## グローバル除外

- `**/dist/**`
- `**/node_modules/**`
- `**/.wrangler/**`
- `**/worker-configuration.d.ts` (Wrangler 自動生成)

## 実行方法

プロジェクトルートで:

```sh
pnpm lint
```

ルート `package.json` の `lint` スクリプトは `eslint .` を実行する。各 workspace の `lint` スクリプトは持たない。

## CI 連携

`.github/workflows/ci.yml` の `check` ジョブで、`main` / `develop` 向け PR 時に `pnpm install --frozen-lockfile` の直後に `pnpm lint` を実行する。`pnpm typecheck` の前に配置し、軽い検査から先に失敗させる。

## 既知の制約 / 拡張ポイント

- 型情報ベースのルール (`@typescript-eslint/no-floating-promises` など) は未導入。`tseslint.configs.recommendedTypeChecked` への切り替えと `parserOptions.project` の設定で追加可能。Cloudflare Workers の `await` 取りこぼし対策として将来検討余地あり。
- Formatter は未導入。Prettier や Biome を入れる場合はこの設定とは独立に管理する。
