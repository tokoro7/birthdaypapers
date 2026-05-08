# Prettier

このプロジェクトにおけるコード整形ツールの構成と運用ルール。

## 採用ツール

- **prettier v3** — 整形本体
- **eslint-config-prettier v10** — Prettier と衝突する ESLint の整形系ルールを無効化
- **lint-staged v17** — `git commit` 時に staged ファイルだけを Prettier にかけるための補助

これらは全てルートの `devDependencies` に集約。各 workspace 個別には入れない。

## 設定ファイル

- `.prettierrc` — Prettier のルール定義。
- `.prettierignore` — Prettier の除外パターン。
- `package.json` (root) の `lint-staged` フィールド — pre-commit でかける拡張子と処理。
- `eslint.config.js` — 末尾に `eslint-config-prettier/flat` を読み込み、ESLint 側の整形系ルールを切る。

## ルール

`.prettierrc`:

| キー            | 値         | 既存コードに合わせた理由                      |
| --------------- | ---------- | --------------------------------------------- |
| `singleQuote`   | `true`     | 既存ファイルがシングルクォート統一            |
| `semi`          | `true`     | 既存ファイル（apps 配下）がセミコロンあり統一 |
| `trailingComma` | `"all"`    | 既存スタイルおよび Prettier v3 のデフォルト   |
| `printWidth`    | `80`       | デフォルト                                    |
| `arrowParens`   | `"always"` | デフォルト                                    |

## 除外

`.prettierignore`:

- `**/dist/`
- `**/node_modules/`
- `**/.wrangler/`
- `**/worker-configuration.d.ts`（Wrangler 自動生成）
- `.husky/_/`（husky 内部ディレクトリ）
- `pnpm-lock.yaml`

## 実行方法

プロジェクトルートで:

```sh
pnpm format        # 全ファイルを書き換え
pnpm format:check  # 整形ズレがないかだけ確認（CI 用）
```

ルート `package.json` のスクリプトは `prettier --write .` / `prettier --check .` を実行する。各 workspace の `format` スクリプトは持たない。

## ESLint との連携

`eslint.config.js` の配列末尾で `eslint-config-prettier/flat` を読み込み、ESLint 側の整形系ルール（インデント・クォート・セミコロン等）を一括で無効化する。整形は Prettier、コードロジックの検査は ESLint、と責務を分ける。

flat config では順序が重要で、`eslint-config-prettier` は **必ず最後** に置く必要がある（前のルールを後ろが上書きするため）。

## husky / lint-staged 連携

`.husky/pre-commit` 内で gitleaks より前に `pnpm exec lint-staged` を実行する。lint-staged 設定 (`package.json` の `lint-staged` フィールド) で、staged ファイルのうち以下の拡張子を Prettier で書き換える:

- `*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml,css,html}`

書き換えられたファイルは lint-staged が自動で再 stage するため、コミット内容には整形済みの状態が含まれる。

husky 全体の構成は [husky.md](./husky.md) を参照。

## CI 連携

`.github/workflows/ci.yml` の `check` ジョブで `pnpm install --frozen-lockfile` の直後、`pnpm lint` よりも前に `pnpm format:check` を実行する。整形ズレがあると CI が落ちるため、ローカルでの `pnpm format` 忘れや lint-staged スキップ時の保険になる。

順序の意図は [cicd.md](./cicd.md) の「PR 時の CI」を参照。

## 既知の制約 / 拡張ポイント

- プラグイン未導入。Tailwind や import 整列など、必要になった時点で `prettier-plugin-*` を追加する。
- エディタ統合はリポジトリ側で強制していない。VS Code なら `esbenp.prettier-vscode` + 「Format on Save」を各自設定すると lint-staged を待たずに揃う。
- 既存 commit の一括整形は導入時に一度だけ実施済み。以降の整形は必要箇所のみ。
