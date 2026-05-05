# CI/CD 計画

`main` 一本運用から、ブランチ分割と自動デプロイのパイプラインに移行するための計画メモ。

## 現状

- ブランチは `main` のみ。ローカルから手動で `wrangler deploy` / `wrangler pages deploy` を実行している。
- 本番 URL:
  - Web: https://birthdaypapers.pages.dev
  - API: https://birthdaypapers-api.tokoro7.workers.dev

## 設計の論点

### 1. ブランチ戦略

候補:

- **A. `main` + `develop` + `feature/*` の三ブランチ構成**
  - `main` = 本番デプロイ済みのスナップショット。直 push 禁止の保護ブランチ。
  - `develop` = 統合ブランチ。普段の作業はここに PR。
  - `feature/*` = 細かい作業ブランチ。`develop` に PR。
  - リリースは `develop → main` の PR をマージ → 本番デプロイトリガ。
  - **採用**
- **B. GitHub Flow（`main` + `feature/*`）**
  - `main` 保護のみ。`feature/*` から `main` へ PR。マージで本番デプロイ。

判断軸: リリース粒度を制御したいなら A、運用負荷を最小化したいなら B。

**未決**

### 2. デプロイ手段

| | 手段 A | 手段 B |
|---|---|---|
| API (Workers) | GitHub Actions で `wrangler deploy` | （Pages のような GitHub 連携機能は無し） |
| Web (Pages) | Cloudflare Pages の GitHub 連携 | GitHub Actions で `wrangler pages deploy` |

推奨:

- API → **GitHub Actions**
- Web → **Pages の GitHub 連携**（PR ごとにプレビュー URL が自動発行される、ビルドも Cloudflare 側でやってくれる）

両方を GitHub Actions に揃える流儀もあり。好みで。

**採用**: API は GitHub Actions、Web は Pages の GitHub 連携。

### パブリックリポジトリでの注意点

リポジトリを public にする前提のため、以下を遵守する。

- Secrets は必ず GitHub Secrets / Cloudflare Dashboard 側に置く。コード・`wrangler.jsonc`・env ファイルに直書きしない。
- `.dev.vars` / `.env.production` は gitignore 済みであることを維持。
- GitHub Actions のトリガーは保護ブランチの `push` 限定。`pull_request_target` は使わない（フォーク PR から secrets が漏れる代表的な穴）。
- ブランチ保護: `main` と `develop` に PR 必須・CI 通過必須・直 push 禁止を設定。
- Pages のフォーク PR プレビュービルドはオフまたは承認制にする。
- Pages の env vars には機密を入れない（現状 `VITE_API_URL` のみで問題なし）。
- `CLOUDFLARE_API_TOKEN` は GitHub Secrets に登録し、API デプロイ workflow からのみ参照。

### 3. GitHub Secrets / Variables

- `CLOUDFLARE_API_TOKEN` — Workers + Pages 編集権限付きトークン（Cloudflare Dashboard → My Profile → API Tokens）
- `CLOUDFLARE_ACCOUNT_ID` — アカウント ID
- Web をローカルビルドする方式なら `VITE_API_URL` を Repo Variable に
- Pages を GitHub 連携にする場合は Pages Dashboard 側で `VITE_API_URL` を環境変数として設定

### 4. PR 時の CI（プッシュ前チェック）

- `pnpm typecheck`（必須）
- 任意: `pnpm --filter @birthdaypapers/web build`
- 任意: `lint`

### 5. プレビュー環境

- Web: Pages の GitHub 連携を使うなら PR ごとに `https://<hash>.birthdaypapers.pages.dev` が自動発行される。
- API: プレビューを作るかどうかが論点。
  - 作る場合: `wrangler.staging.jsonc` 等で staging worker を分け、`develop` ブランチ push で staging にデプロイ。
  - 作らない場合: 本番 worker 一本。

**未決**

## 決定事項（埋めていく）

| 項目 | 決定 |
|---|---|
| ブランチ戦略 | A: `main` + `develop` + `feature/*` の三ブランチ構成 |
| Web デプロイ手段 | A: Cloudflare Pages の GitHub 連携 |
| API プレビュー環境 | TBD |

## 実装手順（決定後に詳細化）

1. `develop` ブランチを切って push、必要なら GitHub のデフォルトブランチを `develop` に変更。
2. `main` のブランチ保護を有効化（直 push 禁止、PR 必須、CI 通過必須）。
3. Cloudflare API Token を発行し、GitHub の Repository Secrets に登録。
4. `.github/workflows/ci.yml` を作成（PR 時の typecheck/build 実行）。
5. `.github/workflows/deploy-api.yml` を作成（`main` への push で `wrangler deploy`）。
6. Web のデプロイ方法に応じて:
   - Pages GitHub 連携なら Cloudflare Dashboard で接続設定、production branch を `main` に。
   - GitHub Actions なら `.github/workflows/deploy-web.yml` を作成。
7. プレビュー API を作る場合: `wrangler.staging.jsonc` を追加し、`develop` 向けの workflow を作成。
8. README に新しい運用ルール（PR 必須・マージ先）を追記。
