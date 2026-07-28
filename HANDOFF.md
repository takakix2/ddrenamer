# DDRenamer — HANDOFF

> このファイルは**現在の状態**を持つ。経緯（なぜそうなったか）は
> `~/dev/agent-guidelines/logs/*-ddrenamer.md` にある。

最終更新: 2026-07-29 / 対応コミット: `1d89a15`

---

## 何のアプリか

PC 破壊で失われた前作（soft.NU の DDRenamer）の再構築。
**「迷わない、広い、速い」** — タブで機能を選び、巨大なドロップゾーンに投げ込むだけでリネームが終わる。

- Frontend: **Tauri v2 + React 19 + Tailwind CSS v4** + lucide-react
- Backend: **Rust**（`std::fs` / `PathBuf` / `regex`）— `src-tauri/src/lib.rs`
- dev ポート: **1425**（`strictPort: true`・`~/dev/CLAUDE.md` のポート登録簿どおり）
- remote: `origin` = Gitea / `github` = `takakix2/DDRenamer` の**2 本**

---

## 現在の状態（2026-07-29 時点で実測済み）

### 完全オフラインで動く ✅

**配布物に外部を呼ぶ URL は 1 件も無い。** release バイナリを `grep -a` して確認済み。
netns を分離（`unshare -rn`）して起動しても、ネット有りと**1 ピクセルも変わらない絵**が出る
（ウィンドウ単体キャプチャで比較・バイト一致）。

- **Web フォントは使わない。** 以前は Google Fonts から Inter を `@import` していた。
  Vite は外部 URL の `@import` をバンドルしないので、**住所が dist の CSS に焼かれていた**。
- 同梱（`@fontsource`）に切り替えるのではなく、**フォントごと捨てた**。実測すると
  UI ラベルは全部日本語 / 数字・拡張子・ファイル名は `font-mono` / 入力欄は weight 500 で、
  **Inter が実際に取得されたのは weight 400 だけ**だった。221KB を払う価値が無い。
- `body` は `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`。
  ⚠️ **OS ごとに顔が変わる**（Linux: Ubuntu Sans / mac: SF Pro / Win: Segoe UI）。承知のうえ。

### CSP が効いている ✅

`tauri.conf.json` の `app.security.csp` に実効ポリシー（以前は `null`）。

```
default-src 'self'; connect-src ipc: http://ipc.localhost; img-src 'self' data:;
style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'
```

- ⚠️ **dev には Tauri が CSP を届けられない**（HTML を返すのは vite なので差し込む応答が無い）。
  `vite.config.ts` の `devCspFromTauriConf` プラグインが `<meta>` として注入する。
  **値は `tauri.conf.json` から読む**（写経すると二重管理になって静かにズレる）。
- ⚠️ **release では Tauri が `script-src`/`style-src` に nonce を追加する。**
  CSP 仕様上 nonce があると `'unsafe-inline'` は無視されるので、**dev と release で実効 CSP が違う**。
  本番 CSS は外部ファイル、React の `style={{}}` は CSSOM 経由で CSP 対象外 —— この 2 つのおかげで
  無傷だった（**release ビルドを起動して目視確認済み**）。
- CSP 違反は `src/main.tsx` で `securitypolicyviolation` を拾って必ず console に出す
  （WebKitGTK は違反を黙って捨てることがあるため）。

### パッケージマネージャは bun 一本 ✅

`bun.lock` が正。`package-lock.json` は削除し `.gitignore` に入れた
（3/25 で止まっていて 4/29 の ESLint 導入が未反映＝**既に嘘だった**。実測: eslint 出現数 0 対 33）。
⚠️ **m4air には node が無い**ので、npm を正にすると別マシンでビルドできない。

---

## リリース成果物（どちらも `1d89a15`）

| プラットフォーム | 焼いた場所 | 成果物 |
|---|---|---|
| Linux x86_64 | blackcube | `deb 5.2M` / `rpm 5.2M` / `AppImage 78M` |
| macOS aarch64 | **m4air** | `DDRenamer.app 13M` / `DDRenamer_0.1.0_aarch64.dmg 5.5M` |

- ⚠️ **macOS 版の署名は adhoc**（`TeamIdentifier=not set`）。自分の Mac なら動くが、
  配ると Gatekeeper が「開発元を確認できません」と言う。Developer ID + notarize は未着手。
- ⚠️ **macOS 版はまだ誰も起動していない。** m4air は GUI キャプチャが TCC で塞がれているので
  目視確認に人の手が要る。**次に開く人が最初の目撃者。**

### macOS 版を焼く手順（m4air）

```bash
ssh m4air
export PATH="$HOME/.bun/bin:$PATH"     # bun は PATH に無い。node/npm は存在しない
cd ~/dev/DDRenamer && git pull && bun run tauri build
```

⚠️ **clone は `git clone gitea:takaki2/DDRenamer.git`**。m4air の `~/.ssh/config` は
`Host gitea` ＋ `IdentitiesOnly yes` なので、**生の `ssh://git@192.168.1.10:222/...` は鍵が選ばれず弾かれる**。

---

## 落とし穴（このリポで踏んだもの）

- 🚨 **`.gitignore` に `logs` がある。** リポ内に `logs/` を作っても**コミットされずに消える**。
  作業ログは `~/dev/agent-guidelines/logs/YYYY-MM-DD-ddrenamer.md` に置くこと（規約どおり）。
- 🚨 **`.gitignore` の `*.png` がアプリのアイコンを巻き込んでいた（`1d89a15` で修正）。**
  `src-tauri/icons/` の 44 枚が未追跡で、**fresh clone はリポ作成以来ずっとビルド不能**だった
  （`generate_context!` が `32x32.png` を開けない）。ローカルには在るのでビルドは通り続けていた。
  → icons を例外化済み。**スクショの ignore は生きている**ので、画像を足すときは場所に注意。
- 🚨 **ビルドの入口が npm だった（`db27f84` で修正）。** blackcube には npm も bun も在るので
  気づけず、**npm の無い m4air で初めて壊れた**。`tauri.conf.json` の `beforeDevCommand` /
  `beforeBuildCommand` は `bun run ...`。
- 🚨 **ビルドキャッシュが旧 vault の絶対パスを掴んで起動不能になっていた。**
  `~/Documents/MyKnowledge_vault/50_Projects/DDRenamer` を参照する build 出力が 27 個、
  改名前のパッケージ名 `app` の成果物まで残っていた（14.7G）。`target/` を全消しして解決。
  移設したリポで初めてビルドするときは疑うこと。
- ⚠️ **Wayland では D&D がファイルマネージャから届かない**（OS 側の制約）。`Ctrl+V` は全環境で動く。

---

## Pending（要件定義書 §4 より）

- [ ] **名前の交換 (Swap)** — 2 ファイル名の入れ替え（一時ファイル経由の 3 段階リネーム）
- [ ] **Undo** — リネーム履歴をスタックし、逆方向の `rename` を実行
- [ ] **サウンド通知** — 完了時の SE
- [ ] **多重拡張子対応** — `.tar.gz` などの正確なパース

## Follow-Ups

- ⏸ **macOS 版の目視確認**（上記のとおり未実施）と、**署名 / notarize の方針**。
- ⏸ **Tailwind v4 を使っている。** `~/dev/CLAUDE.md` は「Tailwind は放棄済・新規 UI は
  `Lethe_UI_Kit` に揃える」なので、移行するか塩漬けにするかの判断が要る（**判断していない**）。
- ⏸ **`bun run tauri dev` の起動確認は XWayland 経由でしかしていない**
  （`GDK_BACKEND=x11` + `xdotool` + `import -window`）。Wayland ネイティブでの目視は人の手が要る。

---

## 検証の型（このリポで確立したもの）

GUI を人に頼まずに確かめる手順。詳細は memory `tauri-gui-verification-lanes`。

```bash
# ウィンドウ単体を撮る（全画面スクショに他の作業が写り込まない）
GDK_BACKEND=x11 ./src-tauri/target/release/ddrenamer &
WID=$(xdotool search --name '^DDRenamer$' | while read i; do \
        xdotool getwindowgeometry "$i" | grep -q '680x638' && echo "$i"; done)
import -window "$WID" shot.png

# 完全オフラインで起動する
unshare -rn bash -c 'ip link set lo up; exec env GDK_BACKEND=x11 ./src-tauri/target/release/ddrenamer'
```

⚠️ **CSP のカナリアだけはネット有りで撃つこと。** オフラインだと「CSP がブロックした」と
「そもそも繋がらない」が同じ絵になり、何も証明できない。
