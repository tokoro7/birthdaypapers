# Husky

git フックを管理するためのツール。pre-commit で gitleaks を走らせるために導入している。

## 採用ツール

- **husky v9** — ルートの `devDependencies` に集約。各 workspace 個別には入れない。

## 設定ファイル

- `package.json` (root) の `scripts.prepare = "husky"` — `pnpm install` 時に自動で `.husky/_/` を生成する。
- `.husky/pre-commit` — コミット前に実行されるスクリプト。git 管理対象。
- `.husky/_/` — husky 内部ディレクトリ。`.husky/_/.gitignore` により自動的に git 管理外。

## pre-commit の中身

`.husky/pre-commit` で gitleaks のステージ差分スキャンを実行する。詳細は [gitleaks.md](./gitleaks.md)。

## セットアップ手順（新規 clone 時）

ルートで:

```sh
pnpm install
```

これだけ。`prepare` スクリプトが走り `.husky/_/` が生成され、フックが自動で有効になる。

加えて gitleaks 本体を別途インストールする必要がある。手順は [gitleaks.md](./gitleaks.md) を参照。

## GUI クライアント (GitHub Desktop など) での注意

GUI クライアントは `~/.zshrc` / `~/.bashrc` を読まずにフックを起動するため、シェルの PATH 設定が反映されず `command not found` になることがある。

その場合は `~/.config/husky/init.sh` に PATH を明示する:

```sh
# ~/.config/husky/init.sh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
```

このファイルは各開発者のホームディレクトリに置くもので、リポジトリには含めない。husky v9 は全フック実行前にこのファイルを source する仕様。

## フックスキップ

緊急時のみ:

```sh
git commit --no-verify -m "..."
```

`--no-verify` はその 1 回だけ pre-commit をスキップする。常用は禁物。CI 側でも gitleaks が走るため、スキップしてもリポジトリ全体としての防御は維持される。

## 既知の制約 / 拡張ポイント

- 現状 pre-commit のみ。pre-push や commit-msg は未使用。導入する場合は `.husky/<hook名>` を新規作成するだけ。
- lint-staged との併用は未導入。pre-commit で `pnpm lint` を流すなら追加検討余地あり。ただし全ファイル lint は重いので、入れるなら lint-staged で staged 分のみに絞るのが現実的。
