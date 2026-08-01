# DDRenamer

Rustの堅牢性とTauriの軽量さを備えた高機能リネームツールです。

![DDRenamer Icon](public/tauri.svg)

## 🌟 特徴

- **🚀 爆速リネーム**: Rust (`std::fs`) によるOSネイティブな高速ファイル操作。
- **🛡️ 安全設計**: 
  - 実行結果をサイドバーログでリアルタイム表示。
  - 同名ファイル存在チェック、空名バリデーション搭載。
  - **拡張子保護**: 文字変換時に誤って拡張子を書き換えないスマート・トリートメント機能。
- **🎨 モダンUI**: 
  - **Tauri v2** + React + **Lethe UI Kit** による洗練されたインターフェース。
  - Tabula / Alethoglyph と**同じデザインシステム・同じ同梱フォント**で見た目を揃えたファミリー。
  - 直感的なフラットデザインとスムーズな操作性。
  - ダークモード標準搭載（Kit の `data-theme` で Lethe / Dark / Light / Cyber を持つ）。
- **📋 柔軟なファイル入力**:
  - **ドラッグ＆ドロップ**: ファイルマネージャーから直接ドロップ。
  - **クリップボードペースト** (`Ctrl+V`): コピーしたファイルを貼り付けて即リネーム。
  - **Alethoglyph 連携**: Alethoglyph で検索 → `Ctrl+C` → DDRenamer で `Ctrl+V` のシームレスなワークフロー。
- **Cross-Platform**: Windows, macOS, Linux 対応。

## 🛠 機能一覧

タブ切り替えにより、以下の高度なリネーム操作を直感的に行えます。

### 1. リネーム (Rename)
- 全ファイルを指定した名前に統一。
- 拡張子の維持/破棄を選択可能。

### 2. 追加 (Add)
- **Add**: 先頭または末尾に文字列を追加（拡張子を跨がない安全設計）。

### 3. 削除 (Trim)
- **Trim**: 先頭または末尾からN文字を削除。

### 4. 置換 (Replace)
- **Replace**: 文字列置換 (**正規表現 Regex 対応**)。

### 5. 連番 (Serial)
- **Advanced Serial**: 接頭辞 (Prefix) + 連番 + 接尾辞 (Suffix)。
- **Keep Original**: 元のファイル名を残したまま連番を付与可能 (`Vacation_001.jpg` 等)。
- **Manual Increment**: ファイルを1つずつドロップするたびにカウントアップする「手動連番」モード搭載。
- **Padding Control**: 桁数（0埋め）を自在に指定。

### 6. 変換 (Convert)
- **Case**: 大文字/小文字変換 (UPPERCASE / lowercase)。**Stemのみに適用**。
- **Width**: 全角/半角変換 (ＡＢＣ ↔ ABC)。**Stemのみに適用**。
- **Extension**: 拡張子の一括変更。

## 📦 ビルドとインストール

### 前提条件
- [Bun](https://bun.sh/)
- Rust (Cargo)
- **`Lethe_UI_Kit` が隣に在ること** — `src/ui-kit` は `../../Lethe_UI_Kit` への symlink です。
  リポジトリ単体を clone しただけではスタイルが解決しません（`~/dev/Lethe_UI_Kit` が必要）。
- Linux でバンドル (`deb`/`rpm`/`AppImage`) を焼くなら `libayatana-appindicator3-dev`
  （実体の `.so` ではなく **`.pc` が必要**。ビルドするマシンにだけ要る）

> パッケージマネージャは **bun に一本化**しています（`bun.lock` が正）。
> m4air には node が入っていないため、npm を正にすると別マシンでビルドできません。

### 開発モード起動
```bash
bun install
bun run tauri dev
```

### リリースビルド
```bash
bun run tauri build
```
生成されたバイナリ (`src-tauri/target/release/bundle/`) を使用してください。

## ⚠️ Known Issues / Notes
- **入力欄の `Ctrl+Z`**: Linux では WebKitGTK にキーバインドが無いため、アプリ側で
  editing command に繋いでいます。**戻す粒度は WebKit が決める**ので、一気に打った名前は
  一度で全部消えることがあります（`Ctrl+Shift+Z` で戻せます）。
- **置けない名前**: 移植性のため、**どの OS でも Windows の規則で弾きます**
  （`< > : " / \ | ? *`・予約名 `CON` 等・末尾のドット/空白）。Linux では合法な `a:b.txt` も作れません。

> 📌 以前ここには「Wayland では D&D が動作しない場合がある」と書いてありましたが、
> **2026-07-30 に GNOME Wayland ネイティブで実機確認したところ D&D も `Ctrl+V` も動きます。**
> 一度も測られないまま運ばれていた記述でした。

## 📜 ライセンス

**MIT License** — 全文は [`LICENSE`](LICENSE)。

⚠️ 配布物には**同梱フォント (SIL Open Font License 1.1)** をはじめとする第三者コンポーネントが
含まれます。それらの表記は [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) に集約しており、
**バイナリを配るときは一緒に配る必要があります**（OFL の要求）。

## 🌱 着想について

「ドロップゾーンに投げ込むだけでリネームが終わる」という発想は、soft.NU の
**[Drag&Drop Renamer](http://nu.way-nifty.com/top/dragdrop_renamer/index.html)** に由来します。

⚠️ **本アプリは同作の移植でも後継でもありません。** 名前も異なり、実装・UI・機能は独自のものです
（Tauri v2 + Rust による作り直しで、Undo / i18n / テーマ / 正規表現置換 などは本アプリ固有）。
着想を得た先として敬意を込めて記載しています。
