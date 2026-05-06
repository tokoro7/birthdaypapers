# Gitleaks

ソースコード・git 履歴・ステージ差分から API キー・トークン・秘密鍵などのシークレットを検出する OSS スキャナ。

## 採用理由

このリポジトリは public 公開を前提としており、CLAUDE.md の "Security (public repository)" 方針でも「Never commit secrets」を最優先事項として掲げている。事故防止のため、機械的なスキャナを **pre-commit（ローカル一次防御）** と **CI（PR 時の二次防御）** の二段構えで導入する。

## 二段構えの全体像

| 層 | 実行タイミング | 対象 | スキップ可否 |
|---|---|---|---|
| pre-commit | ローカルでの `git commit` 時 | ステージされた差分のみ | `--no-verify` でスキップ可 |
| CI | `develop` / `main` への PR 時 | PR 差分（push 時は履歴全体） | スキップ不可（PR マージ条件） |

ローカルで pre-commit を `--no-verify` でスキップしても CI 側で必ず引っかかるため、リポジトリ全体としての防御は維持される。

## ローカル導入

### gitleaks 本体のインストール

macOS:

```sh
brew install gitleaks
```

その他の OS は https://github.com/gitleaks/gitleaks/releases からバイナリを取得。

確認:

```sh
gitleaks version
```

### pre-commit フック

husky 経由で `.husky/pre-commit` から実行する。husky のセットアップは [husky.md](./husky.md) を参照。

`.husky/pre-commit` の中身は `gitleaks protect --staged --redact --verbose` を実行する形。バイナリ未インストール時は分かりやすいエラーメッセージで停止する。

### コマンドの使い分け

- `gitleaks protect --staged` — ステージされた差分のみ。pre-commit 用。高速（数十〜数百 ms）。
- `gitleaks detect` — 作業ツリー＋git 履歴。重い。CI の push 時や手動の履歴監査用。
- `gitleaks dir <path>` — 任意ディレクトリのファイルスキャン。履歴は見ない。

## CI 連携

`.github/workflows/ci.yml` の `secret-scan` ジョブで、`develop` / `main` 向け PR 時に `gitleaks/gitleaks-action@v2` を実行する。

- `actions/checkout@v4` で `fetch-depth: 0` を指定し、履歴全体を取得。
- PR イベントでは差分のみ、`push` イベントでは履歴全体を自動でスキャンする（gitleaks-action の挙動）。
- 個人/公開リポジトリではライセンスシークレット不要（org repo の場合のみ `GITLEAKS_LICENSE` が必要）。

CI ジョブは `check` ジョブと並列で動く独立ジョブ。履歴スキャンのため `fetch-depth: 0` が必要で、既存の `check` ジョブに混ぜると全ステップが遅くなるため分離している。

## 誤検知への対処

### 全体ルールの調整

リポジトリルートに `.gitleaks.toml` を置くとデフォルトルールを上書き・拡張できる。allowlist で特定パス・コミット・正規表現を除外可能。

```toml
# .gitleaks.toml の例
[allowlist]
paths = ['''apps/api/samples/.*''']
regexes = ['''EXAMPLE_KEY_.*''']
```

### インラインでの個別抑制

行末に `# gitleaks:allow` を付けるとその行だけ無視される:

```ts
const dummyKey = "AKIAIOSFODNN7EXAMPLE" // gitleaks:allow
```

ただし「本物のキーを誤って allow する」のが一番怖いパターンなので、インライン抑制は最小限に。

## 検出されたときの対応

**最重要**: gitleaks がコミット済みの履歴から本物のシークレットを検出した場合は、**まず発行元 (NYT / Anthropic / Cloudflare 等) でキーをローテーションする**。git 履歴から該当ファイルを消すだけでは不十分（履歴の値は残る、または既に他者にクローンされている可能性がある）。

手順:

1. 発行元でキーを失効させ、新しいキーを発行。
2. 新キーを GitHub Secrets / Cloudflare Dashboard / `.dev.vars` に登録。
3. 該当箇所を修正してコミット。
4. 必要に応じて履歴の書き換え（`git filter-repo` 等）も検討するが、優先度は 1 が圧倒的に高い。

## 既知の制約 / 拡張ポイント

- 初回導入時の履歴スキャンは未実施。気になる場合は `gitleaks detect --source . --verbose` をローカルで一度走らせる。
- カスタムルールは未定義（デフォルトルールのみ）。プロジェクト固有の機密パターン（社内トークン等）が出てきた場合は `.gitleaks.toml` で追加。
- pre-commit は staged 差分のみのため、ファイルを add せずに置いてある状態は検知できない。CI 側で履歴スキャンが走るので、最終的にはそこで補足される。
