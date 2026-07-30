# DDRenamer — HANDOFF

> このファイルは**現在の状態**を持つ。経緯（なぜそうなったか）は
> `~/dev/agent-guidelines/logs/*-ddrenamer.md` にある。

最終更新: 2026-07-30（blackcube セッション・2 回目）
直近の変更: **i18n (ja/en) とテーマ切替 (4 種) を実装**＋**設定モーダルを新設**。
その前（同日 1 回目）: **UI を Tailwind v4 から `Lethe_UI_Kit` へ移行**（Tabula / Alethoglyph と
ファミリー統一）＋**CSD 窓の窓操作を実装**（掴み・リサイズ・アイコン。どちらも「無かった」もの）。
その前: macOS の UI 無反応を修正（`1d89a15` まで壊れていた・下記の解決済みセクション）

---

## 🎯 次にやること

**空の名前で隠しファイルが作れるバグ**（下の「未修正」セクション）。**唯一残っている既知の
正しさの欠陥**で、Rust 側 10 行程度。モードごとに検査がバラけているのが本当の形なので、
`Fixed` に stem の空検査を足すだけでなく、**番人の置き場所を揃える**ところまでやると良い。

そのあと配布に向けるなら **macOS 版の焼き直し**（m4air）。⚠️ **今 m4air に在る成果物は
`1d89a15` ＝ UI 移行も i18n も入っていない**ので、配る前に必ず焼き直すこと。

---

## 何のアプリか

PC 破壊で失われた前作（soft.NU の DDRenamer）の再構築。
**「迷わない、広い、速い」** — タブで機能を選び、巨大なドロップゾーンに投げ込むだけでリネームが終わる。

- Frontend: **Tauri v2 + React 19 + Lethe_UI_Kit**（CSS 共有デザインシステム）+ lucide-react
  - ⚠️ **Tailwind v4 は 2026-07-30 に撤去済み**（`~/dev/CLAUDE.md` の「Tailwind 放棄済」に合流）
- Backend: **Rust**（`std::fs` / `PathBuf` / `regex`）— `src-tauri/src/lib.rs`
- dev ポート: **1425**（`strictPort: true`・`~/dev/CLAUDE.md` のポート登録簿どおり）
- remote: `origin` = Gitea (`takaki2/DDRenamer`) / `github` = **`takakix2/ddrenamer`**（小文字）の**2 本**
  - ⚠️ GitHub 側は途中で `DDRenamer` → `ddrenamer` に**改名されていた**。push はリダイレクトで
    通ってしまうので気づきにくい（`git remote set-url` 済み・2026-07-30 に記載も修正）

---

## 現在の状態（2026-07-29 時点で実測済み）

### 完全オフラインで動く ✅（フォント同梱後も維持・2026-07-30 再実測）

**配布物に外部を呼ぶ URL は 1 件も無い。** release バイナリの `strings` に残るのは
dbus 仕様の URL・tauri の panic メッセージ内の GitHub リンク・Adobe XMP 名前空間・
`http://ipc.localhost`（CSP の値そのもの）だけで、**CDN もフォントホストも無い**。
netns を分離（`unshare -rn`）して起動しても、ネット有りと**1 ピクセルも変わらない絵**が出る
（ウィンドウ単体キャプチャで **sha256 一致**）。

- **フォントは同梱している**（`main.tsx` が `@fontsource-variable/noto-sans-jp` と
  `@fontsource-variable/jetbrains-mono` を import）。**方針転換の経緯**:
  - 元は Google Fonts の Inter を `@import` していた（住所が dist の CSS に焼かれていた）。
  - 一度は**フォントごと捨てた** —— Inter が実際に描いていたのは weight 400 だけで、
    221KB を払う価値が無いと実測したため。
  - **2026-07-30 に同梱へ戻した。** `Lethe_UI_Kit` に移行してトークン `--font-sans` が
    `Noto Sans JP Variable` を先頭に置く形になったから。🚨 **配っていないフォントを
    指定するのが一番まずい** —— OS に同名フォントが在る機械だけ当たり、無い機械は別フォントに
    落ちる ＝ **同じ画面が機械ごとに違う字で出て、しかも指定は書いてあるので気づけない**
    （Kit 自身のコメントがこれを警告している）。Tabula / Alethoglyph と同じ字面に揃える判断。
- **同梱はオフライン保証を壊さない**（`url()` は自分の origin）。`unicode-range` 分割は
  保たれていて **130 チャンク** —— Google Fonts と同じ「必要な文字の chunk だけ読む」挙動でローカル。
- **代償はサイズ**: deb 5.2M → **11M** / AppImage 78M → **83M**（CJK フォントの分）。
  ⚠️ 文字範囲を自分で絞ってはいけない（欠けても豆腐にならず別フォントに落ちるだけなので、
  「なんとなく字が違う」で終わる）。

### 🚨 `assetsInlineLimit: 0` は load-bearing（外すとフォントが CSP で弾かれる）

`vite.config.ts` の `build.assetsInlineLimit: 0` は**飾りではない**。
既定（4096 バイト未満をインライン化）だと、130 個のフォントチャンクのうち**小さい 2 個が
`data:` URI に化け**、`font-src` 指令を持たない CSP が `default-src 'self'` に落ちて
**実際にブロックしていた**（DOM カナリアで `[CSP-HIT] font-src -> data` を 2 回観測）。

⚠️ **ブロックされても画面は出る。** その文字範囲だけ別フォントに落ちるので、
症状は「なんとなく字が違う」。**CSP を緩める（`font-src 'self' data:`）方は採らなかった** ——
全部ファイルなら `'self'` だけで足り、custom protocol 越しのローカル取得なので代償が無い。

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
- CSP 違反は `src/main.tsx` で `securitypolicyviolation` を拾って console に出す
  （WebKitGTK は違反を黙って捨てることがあるため）。
- 🚨 **ただし release ではその console が端末に届かない**（2026-07-30 実測）。
  release バイナリをシェルから起動しても stdout/stderr に**1 行も出ない** ——
  `console.error("...")` を仕込んだカナリアでも空だった。
  ⇒ **「release を起動して stderr が空 ＝ CSP 違反なし」とは言えない。**
  release で確かめるときは**違反を DOM に書き出す一時カナリア**を仕込んで
  スクリーンショットで読む（この方法で上記の `font-src -> data` を捕まえた）。

### UI は Lethe_UI_Kit に乗っている ✅（2026-07-30 移行）

**見た目の正本は `src/ui-kit` = `../../Lethe_UI_Kit` への相対 symlink。**
Tabula / Alethoglyph と**同じ実体**（`~/Lethe_Appliance/Lethe_UI_Kit`）を指す。

⚠️ **相対にしてある理由**: blackcube では `~/dev/Lethe_UI_Kit` 自体が symlink、
m4air では実体ディレクトリ。**相対ならどちらの機械でも同じに解決する**
（Alethoglyph は絶対パスで貼っていて、これは機械を跨ぐと壊れる形）。
Tabula の `src/ui-kit -> ../../Lethe_UI_Kit` と同型に揃えた。

`src/index.css` が取り込むもの:
`themes/_variables` → `themes/_lethe` → `components/_reset` / `_buttons` / `_inputs`。

| 何 | どこが持つ |
|---|---|
| 入力欄 | Kit `.lethe-input`（`+ .compact` で 36px 行に詰める） |
| ボタン | Kit `.btn` / `.btn-secondary` / `.lethe-icon-btn` |
| 真偽値 | Kit `.toggle-switch` + `.toggle-slider`（**チェックボックスから変更**。Kit に checkbox の作法が無く、トグルが Kit の真偽値の言葉だから） |
| 選択メニュー | Kit `components/tsx/CustomSelect`（自前の `DropdownSelect` 41 行を畳んだ） |
| モード選択タブ / ドロップゾーン / CSD 帯 / ログバー / 数値スピナー | **`src/App.css`（アプリ固有）** |

🚨 **`src/App.css` に hex を直接書かないこと。** 必ず `var(--*)` 経由。
直書きすると `data-theme` を切り替えても半分だけ効く UI になる（Kit は Lethe / Dark / Light / Cyber を持つ）。

⚠️ **モード選択タブは Kit の `.search-tab` を使っていない。** あちらは gap 16px で並ぶ
下線テキストタブ（本文切替用）で、こちらは**全幅を埋める 6 モードのセレクタ**
（「迷わない、広い、速い」の *広い* 部分）。構造は自前で持ち、
**active を accent の下線で示す作法だけ Kit から借りている**。

### i18n とテーマは入っている ✅（2026-07-30 実装・実機確認済み）

**`i18next` + `react-i18next`**（Tabula / Alethoglyph と同じ組）。設定は**同一窓のモーダル**。

| 何 | どこ |
|---|---|
| 言語（同梱 ja/en のみ） | `src/i18n/config.ts` + `src/i18n/locales/{ja,en}.json` |
| テーマ（lethe / dark / light / cyber） | `src/theme.ts` — 実体は Kit の `_lethe.css`、こちらは `data-theme` を書くだけ |
| 設定 UI | `src/SettingsModal.tsx`（歯車は **`.logbar-actions`**・`⌘,` / `Ctrl+,` でも開く） |
| 永続化 | `localStorage`: `ddrenamer-ui-language` / `ddrenamer-theme` |
| 破れの検出 | `bun run check:locales`（キー欠落と `<Trans>` スロット不一致を見る） |

**❌ 「訳文は Kit が配っている」は誤りだった。** Kit の `locales/*.json` は **Lethe Client の
アプリ文言**（NAS 接続・RAG・チャット）で、流用できたのは `settings.theme` 級の数語だけ。
訳文は自前で持つ。補間は **i18next 既定の `{{name}}`** に統一した（Kit 内部は `{n}` と
`{{count}}` に割れていて、規約として借りられない）。

🚨 **`POSITION_OPTIONS` をモジュール定数に戻さないこと。** `t()` は言語で変わるので、
定数のまま持つと**言語を切り替えてもあの 3 つのセレクタだけ古い言語で残る**
（他が全部切り替わるので「たまたま訳し漏れ」に見えて原因に辿り着けない）。`useMemo` で持つ。

🚨 **削除タブの一文だけは `<Trans>`。** 語順が言語で入れ替わるため（ja「[末尾] **から** [3]
**文字削除する**」/ en「**Delete** [3] **characters from the** [end]」）、部品の並びを
**locale 側**が決める。スロットは `<pos>` / `<count>` / `<t1>` / `<t2>`。
⚠️ **地の文もスロット (`t1`/`t2`) に入れる** —— 素のテキストノードにすると `.field-text` を
当てる先が無くなって字面が周りとズレる。
💡 空タグ (`<count></count>`) でも**元の children は保たれる**（スピナーの中身は消えない・実機確認）。

📌 **ログバーは英語のレーン。** 実行ログの status は Rust (`lib.rs`) が返す機械の値なので
**翻訳しない**（`res.status === "Success"` で分岐にも使っている）。
2026-07-30 に `lib.rs:199` の `"検索文字列が空です"` だけ日本語で取り残されていたのを
`"Search string is empty"` に揃えた。**時刻だけはロケールに従う**
（`toLocaleTimeString(i18n.language)` ＝ ja `15:05:25` / en `3:04:49 PM`。実機で両方確認）。

⚠️ **時刻の言語は hook ではなく singleton (`i18nInstance`) から読む。** `processFiles` は
deps `[]` の effect に捕まる関数（設定を `configRef` で渡しているのはそのため）なので、
hook 由来の値を入れると「第 1 レンダーの値を握った関数」になる。実体は同じインスタンスで
結果も正しいが、**読んだ人には分からないし lint も鳴る**。

### 🚨 Kit の `_settings.css` は取り込んでいない（未定義トークンを参照している）

Kit の `.settings-section` は `background: var(--layer-1)` を使うが、**`--layer-1` は Kit にも
Tabula にも Alethoglyph にも定義が無い**（`_settings.css` 内の 2 箇所で使われるだけの宙ぶらりん）。
取り込むと**背景が透明のまま**出る。要る 5 クラス（`.settings-section` / `.section-title` /
`.setting-row` / `.setting-info` / `.setting-control`）は **Kit と同じ名前で `App.css` に自前で持つ**。
`.modal-*` の方は健全なので `_modal.css` はそのまま使っている。

🚨 **`_modal.css` の `.modal-body` は `overflow-y: auto`。** `CustomSelect` のリストは
container 内の absolute なので、**開いたリストが本文の枠で切られる** —— 実機で 4 つ目の
テーマ (Cyber) がスクロールしないと押せなかった。`.settings-modal .modal-body` を
`overflow: visible` にして解決。⚠️ **設定項目が増えて縦に伸びたら破綻する**（本文が溢れる）ので、
そのときは切り方を考え直すこと。

### CSD 窓の窓操作は「自前で持つもの」✅（2026-07-30 実装）

`decorations: false` にした時点で、**掴む・リサイズする・閉じるは全部自分の仕事**になる。
このリポはそれを**持っていなかった**（画面は出ていたので気づかれずに残っていた）。

| 何 | どこ | 🚨 罠 |
|---|---|---|
| **窓を動かす** | `App.tsx` の `handleDrag` | **属性 `data-tauri-drag-region` だけでは掴めない。** `pointerdown` から明示的に `startDragging()` を呼ぶ。⚠️ 属性は**イベント target 自身**に必要（バブリングでは届かない）＝ 属性を持たない子要素は**ドラッグを飲み込む** |
| **リサイズ** | `WindowResizeHandles.tsx` + `App.css` | 8 方向の透明 div が `startResizeDragging(dir)`。辺 **12px** / 角 **20px**（Tabula が 8/16 から広げた値） |
| **− □ ✕** | `App.tsx` の `.titlebar-btn` | lucide アイコン（`Minus` / `Square` / 最大化中は `Copy` / `X`）。⚠️ 文字グリフに戻さない（OS ごとに顔が変わる・`❐` は無いフォントがある） |

⚠️ **カーソルは native キーワードのみ**（`ew-resize` 等）。`url()` の png は WebKitGTK が
`GDK_SCALE` でスケールせず HiDPI で極小になる。
⚠️ **ドラッグ中のカーソルは CSS で制御できない**（native handoff ＝ コンポジタが所有する）。
`cursor: !important` を書いても無視されるので、書かないこと。

**意図的な妥協 2 つ:**
- **右上の角そのものからはリサイズできない**（角ハンドルは ✕ の左隣に逃がしてある）。
  **右辺もタイトルバーの下から始まる** —— 上端まで伸ばすと ✕ の右数 px に板が乗って押せなくなる。
- **macOS では 8 枚を描いていない**（`decorations: true` ＝ ネイティブの縁が在る）。
  ⏸ **m4air での実機確認が未了。**

💡 **角のカーソルがホバーとドラッグで跳ねるのはアプリのバグではない** ——
blackcube の cursor theme が `whiteglass`（古い X11 名のみ）で `nwse-resize` を持たないため。
`gsettings set org.gnome.desktop.interface cursor-theme 'Adwaita'` で消える（実証済・**未適用**）。

### パッケージマネージャは bun 一本 ✅

`bun.lock` が正。`package-lock.json` は削除し `.gitignore` に入れた
（3/25 で止まっていて 4/29 の ESLint 導入が未反映＝**既に嘘だった**。実測: eslint 出現数 0 対 33）。
⚠️ **m4air には node が無い**ので、npm を正にすると別マシンでビルドできない。

---

## リリース成果物（どちらも `1d89a15`）

| プラットフォーム | 焼いた場所 | 成果物 |
|---|---|---|
| Linux x86_64 | blackcube | **2026-07-30 に焼き直し**: `deb 11M` / `rpm 11M` / `AppImage 83M`（フォント同梱で倍増） |
| macOS aarch64 | **m4air** | `DDRenamer.app 13M` / `DDRenamer_0.1.0_aarch64.dmg 5.5M` ⚠️ **UI 移行前 (`1d89a15`) の物**|

⚠️ **macOS 版は UI 移行を含んでいない。** 焼き直しが要る（下の follow-up）。

- ⚠️ **macOS 版の署名は adhoc**（`TeamIdentifier=not set`）。自分の Mac なら動くが、
  配ると Gatekeeper が「開発元を確認できません」と言う。Developer ID + notarize は未着手。
- ✅ **macOS 版の UI 無反応は解決**（下記セクション）。`1d89a15` の `.app` / `.dmg` は
  **操作不能なので破棄すること**。macOS 版は修正後に焼き直しが要る。

### macOS 版を焼く手順（m4air）

```bash
ssh m4air
export PATH="$HOME/.bun/bin:$PATH"     # bun は PATH に無い。node/npm は存在しない
cd ~/dev/DDRenamer && git pull && bun run tauri build
```

⚠️ **clone は `git clone gitea:takaki2/DDRenamer.git`**。m4air の `~/.ssh/config` は
`Host gitea` ＋ `IdentitiesOnly yes` なので、**生の `ssh://git@192.168.1.10:222/...` は鍵が選ばれず弾かれる**。

---

## ✅ 2026-07-29: macOS 版の UI 無反応 — 解決（犯人は `decorations: false`）

Status: **resolved**（m4air で修正・実機で操作確認済み）
Observed on: macOS 26.5.2 arm64（m4air）
Broken in: `1d89a15`（`.app` / `.dmg` とも）

### 症状

**UI 全体が反応しない。** − □ ✕ が押せず、ドラッグでも動かせず、
**タブ切り替えも文字入力もできない**。ウィンドウの描画だけは完全。

### 原因

`decorations: false` ＝ macOS では `NSWindowStyleMaskBorderless`。
**borderless の NSWindow は既定で `canBecomeKeyWindow` が false** なので、
キーウィンドウになれず**入力が WebView まで降りてこない**。

Accessibility API で機械的に裏を取った（当時 GUI キャプチャが TCC で使えなかったため）:

| ビルド | `AXCloseButton` | `AXFocusedUIElement` |
|---|---|---|
| `decorations: false` | nil | **AXWindow** ← WebView にフォーカスが渡らない |
| `decorations: true` | present | **AXWebArea** |

⚠️ **CSP は無罪**（CSP を外しただけのビルドでも同症状）。**Linux は正常**。
今日が macOS の初ビルドなので「今日の変更が壊した」ではなく
**リポ作成以来ずっと macOS では動いていなかった**が正しい。

### 直し方

**`src-tauri/tauri.macos.conf.json`（新規）** で macOS だけ挙動を変える:

```json
"decorations": true, "titleBarStyle": "Overlay", "hiddenTitle": true,
"trafficLightPosition": { "x": 13, "y": 18 }
```

**`src/App.tsx`** は `isMac`（`navigator.userAgent.includes("Macintosh")`）で
**帯の中身だけ**を出し分ける（macOS ではタイトル文字と − □ ✕ を描画しない）。

📌 **32px の帯そのものは全プラットフォームで残す。** ドラッグ領域であると同時に、
**設定ボタンを置ける唯一の共通の土地**だから（i18n / テーマ の入口が今後要る）。
素のネイティブタイトルバーにすると macOS だけこの土地を失う。

判定を実行時にしたので **`dist` は全 OS 共通**（クロスビルドで取り違える余地がない）。

### ⚠️ `tauri.macos.conf.json` は `windows` 配列を丸ごと持つ ＝ 二重管理

プラットフォーム別 config は **JSON Merge Patch (RFC 7396)** で合成され、
**配列は要素単位ではなく丸ごと置換**される。よって `title` / `width` / `height` /
`resizable` / `maximizable` を macOS 側にも**書き写してある**。
🚨 **ウィンドウサイズ等を変えるときは 2 ファイル両方**を直すこと。片方だけ直すと
macOS だけ古い値のままになり、しかもビルドは通る。

### `trafficLightPosition` の `y` は「ボタンの座標」ではない

tao の実装（`platform_impl/macos/view.rs: inset_traffic_lights`）は

```
title_bar_frame_height = closeButton.height + y
```

でコンテナ高を決めるだけ。AppKit は原点が左下なので、実際に効くのは
**ウィンドウ上端からボタン上端までの隙間 = y − (ボタンの元の下端オフセット `b`)**。

`y=9` のとき AX 実測で隙間 **−1px**（上端からはみ出していた）→ `b=10` と判明。
32px の帯に 16px のボタン（AX フレーム）を中央に置く `隙間=8` から **`y=18`** を逆算し、
焼き直して `dy=8` を再測定して一致を確認した。ネイティブの Terminal.app も `dy=8`。

⚠️ Overlay の既知の制約（tauri のドキュメント記載）:
**ウィンドウが非フォーカスのときは drag region で動かせない**（[tauri#4316](https://github.com/tauri-apps/tauri/issues/4316)）。

### 🚨 m4air では GUI キャプチャの TCC 主体は **tmux**

claude は tmux セッション内で動いており、tmux サーバの親は launchd（＝ターミナルから独立）。
そのため **画面収録の許可はターミナルアプリではなく `/opt/homebrew/bin/tmux` に紐づく**。
Alacritty / Ghostty を許可しただけでは足りず、実行時に **"tmux" 名義のダイアログ**が出る。
**許可すれば再起動なしで即座に撮れる**（tmux サーバを落とす必要はない ＝ セッションは死なない）。

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
- ✅ **Wayland では D&D も `Ctrl+V` も動く**（2026-07-30 に blackcube = GNOME Wayland ネイティブで実機確認）。
  D&D は手で 3 モード（追加 / 削除 / リネーム）とも成功、`Ctrl+V` も 2 ファイル成功。
  🚨 **ここは「Wayland では D&D が届かない・OS 側の制約。`Ctrl+V` は全環境で動く」と書いてあったが、
  事実は逆だった。** 姉妹アプリの記録（`agent-guidelines/logs/2026-07-09.md`・Tabula）はこうある ——
  「clipboard からのペースト不能。`tauri-plugin-clipboard-x` が `SetupFailed` で panic（Wayland）。
  **D&D は別経路で動く**」。壊れていたのは**クリップボード側**で、D&D ではない。
  この行は HANDOFF 新設コミット (`3fabf38`) から入っていて、**一度も測られないまま運ばれていた**。
  ⚠️ **環境側の制約として書いた記述は、黙って古くなる**（誰も再測定しない）。しかもこの道具の
  売りは D&D の速さなので、**価値の中心が死んでいることになっていた**。
- ⏸ **`tauri-plugin-clipboard-x` は `.unwrap()` を持っている**（2.0.1 / 2.0.2 とも
  `ClipboardManager::new()` の `ClipboardContext::new().unwrap()`）。`OnceLock` の遅延初期化なので
  **起動時ではなく最初の `Ctrl+V` で構築される** ＝ 失敗すると**貼ろうとした瞬間に panic**。
  今の blackcube では再現しないが、Tabula が実際に踏んでいる。**売りではない経路（貼り付け）が
  道具ごと巻き込みうる**形なので、頭の隅に置くこと。
- 📌 **同じクリップボードで 2 回貼ると 2 回目は `File not found`** になる（1 回目で名前が変わっており、
  クリップボードは古い名前を指したまま）。挙動としては正しいが、「効いたか不安でもう一度押す」は
  自然な操作なので、失敗に見える。

---

## 🐛 未修正: 空の名前 + 拡張子維持 で **隠しファイルが作れる**（2026-07-30 発見）

**再現**: 「リネーム」タブで名前を**空のまま**ファイルを投入すると、
`photo_a.jpg` → **`.jpg`** に成功する（実機で確認）。README は「空名バリデーション搭載」と
謳っているが、通っている。

**機構**: `src-tauri/src/lib.rs`
- `RenameCommand::Fixed` は `keep_ext && !ext.is_empty()` なら `join_name_ext(name, ext)` を返す
  → `name` が空でも **`".jpg"`** という「空でない名前」になる（`lib.rs:156`）。
- 最後の番人 `if new_name.is_empty()`（`lib.rs:282`）は**完成した名前**しか見ないので、
  `".jpg"` は空ではない ＝ 素通りする。

⇒ **stem が空かどうかを見ていない**のが穴。`Trim` 側には
`Resulting name is empty after trim`（`lib.rs:243`）という別の番人が居るので、
**モードごとに検査がバラけている**のが本当の形。

📌 UI 移行の実験（エラー行の CSS を確かめるために空名で撃った）で偶然踏んだもので、
**今回の変更が作ったバグではない**。Rust 側の挙動変更になるので移行スコープ外にした。

## Pending（要件定義書 §4 より）

- [ ] **名前の交換 (Swap)** — 2 ファイル名の入れ替え（一時ファイル経由の 3 段階リネーム）
- [ ] **Undo** — リネーム履歴をスタックし、逆方向の `rename` を実行
- [ ] **サウンド通知** — 完了時の SE
- [ ] **多重拡張子対応** — `.tar.gz` などの正確なパース

## Follow-Ups

- 🔶 **macOS 版の焼き直しと配布判断。** UI 無反応は直ったので配れる状態になったが、
  **署名は adhoc のまま**（次項）。`--bundles app` でしか焼いていないので **dmg は未生成**。
  ⚠️ **Linux の release も i18n 移行後は焼いていない**（最後の焼きは 2026-07-30 のフォント同梱時）。
- 🔶 **macOS のネイティブメニューに「設定… ⌘,」の項目が無い。** キーボードショートカットは
  実装したが、macOS で標準の入口である**メニュー項目**は Rust 側の menu 構築が要るので未着手。
- 🔶 **Kit の `--layer-1` が宙ぶらりん**（`_settings.css` が参照するのに定義が無い）。
  DDRenamer は `_settings.css` を避けて回避したが、**Lethe Client 側は透明な背景で出ているはず**。
  Kit に 4 テーマ分の定義を足すのが筋だが、横断変更（lethe-client / Tabula / Alethoglyph）なので
  今回はやっていない。`.custom-select-container` の 3 重複と**同じ性質の借金**。
- 🔶 **連番タブでは `Ctrl+V` がリネームを起こさない。** タブを開くとプレフィックス入力が
  **自動フォーカス**され、`Ctrl+V` は「入力欄にフォーカスがあれば素通し」の早期 return に当たる。
  設計としては正しい（欄に貼れないと困る）が、**このタブだけ貼ってもリネームされない**のは
  説明が要る挙動。D&D は影響を受けない。今回の変更で入ったものではない。
- 🔶 **macOS でリサイズハンドルを描かない判断が未検証。** `decorations: true` ＝ ネイティブの縁が
  在るので不要という読みだが、`titleBarStyle: Overlay` との兼ね合いは m4air で見ていない。
  **焼き直しのときに必ず縁を掴んで確かめる**こと。
- 🔶 **`.custom-select-container` / `-value` / `-icon` の 3 ルールが Kit に無い。**
  Kit は `components/tsx/CustomSelect.tsx` を配っているのに CSS を持たないので、
  **Tabula (`style.css:259`) / Alethoglyph (`App.css:678`) / DDRenamer (`App.css`) が
  同じものを 3 箇所で書いている**。Kit の `_inputs.css` に上げるべきだが、
  横断変更（lethe-client / Lethe Web UI も巻き込む）なので今回はやっていない。
- ⏸ **署名 / notarize の方針**（現状 adhoc）。配る段になったら Developer ID が要る。
- ⏸ **フォント同梱でバンドルが倍になった**（deb 5.2M → 11M）。絞るなら subset だが、
  欠けた文字が豆腐にならず別フォントに落ちるので**壊れても気づけない**。今は絞らない判断。
- ⏸ **`bun run tauri dev` の起動確認は XWayland 経由でしかしていない**
  （`GDK_BACKEND=x11` + `xdotool` + `import -window`）。Wayland ネイティブでの目視は人の手が要る。

---

## 検証の型（このリポで確立したもの）

GUI を人に頼まずに確かめる手順。詳細は memory `tauri-gui-verification-lanes`。

### 🚨 `GDK_BACKEND=x11` のキャプチャで**字の出来を判断してはいけない**（2026-07-30 実測）

blackcube は **GNOME の 150% 分数スケーリング（Wayland・物理 3840×2160 / 論理スケール 1.5）**。
`GDK_BACKEND=x11` を付けると **XWayland** に落ちるので、アプリは **DPR 1.0 で描く**
（実測: 論理 680 px の窓のバッファが **680 device px**）。それをコンポジタが 1.5 倍に
引き伸ばすため、**画面上の字は必ずぼやける**。

**Wayland ネイティブ（`GDK_BACKEND` を付けない）なら DPR 1.5 で描かれ、くっきり出る**
（実測: 同じ窓が **1020×957 device px**。同じ文字を原寸で並べて確認済み）。

⇒ **レイアウト・色・文言は X11 キャプチャで判断してよいが、字のにじみ・線の太さ・
アイコンの粗さは判断できない**（このリポのスクショは全部 X11 経由なので、
「なんかぼやけて見える」は**撮り方の産物**であってアプリの状態ではない）。

Wayland ネイティブで撮るときは `xdotool` / `import` が使えないので:

```bash
bun run tauri dev &                  # GDK_BACKEND は付けない
gnome-screenshot -f /tmp/full.png    # 画面全体（窓の位置は目で探す）
# 窓は「論理サイズ × 1.5」で写る: 680x638 → 1020x957
convert /tmp/full.png -crop 1020x957+<x>+<y> +repage /tmp/win.png
```

⚠️ AT-SPI は窓の位置を **(0,0) と答えることがある**（Wayland では実座標を返せない）。
サイズは論理 px で返る（680×638）ので、**device px に直すには 1.5 倍**が要る。

```bash
# ウィンドウ単体を撮る（全画面スクショに他の作業が写り込まない）
GDK_BACKEND=x11 ./src-tauri/target/release/ddrenamer &
WID=$(xdotool search --name '^DDRenamer$' | while read i; do \
        xdotool getwindowgeometry "$i" | grep -q '680x638' && echo "$i"; done)
import -window "$WID" shot.png

# 完全オフラインで起動する
unshare -rn bash -c 'ip link set lo up; exec env GDK_BACKEND=x11 ./src-tauri/target/release/ddrenamer'
```

### 🚨 `xdotool` で打つときは `--window` を付けてはいけない（2026-07-30 に確立）

`xdotool key --window <id> ctrl+comma` は **XSendEvent**（合成イベント）で送るが、
**GTK は `send_event=true` のイベントを既定で捨てる** —— エラーも出ず、**何も起きない**。
`--window` を外すと **XTEST**（本物の入力）になり、そのまま効く。

```bash
xdotool windowactivate --sync "$WID"; sleep 0.5
xdotool key ctrl+comma            # ← --window を付けない
xdotool mousemove $((X+438)) $((Y+347)) click 1   # 座標は getwindowgeometry --shell の X,Y 基準
```

⚠️ **起動直後の 1 枚は信用しない。** 窓が map された直後に撮ると **レイアウト確定前のフレーム**が
写る（実際、ドロップゾーンが消えてログ本文が溢れた絵が撮れて、状態のバグかと追いかけた）。
数秒待つか、**同じ絵が 2 回撮れること**を確かめてから読むこと。

⚠️ **CSP のカナリアだけはネット有りで撃つこと。** オフラインだと「CSP がブロックした」と
「そもそも繋がらない」が同じ絵になり、何も証明できない。

### release の中を覗く型 — **DOM カナリア**（2026-07-30 に確立）

release は console が端末に届かない（上記）。**測りたい値を画面に描いてスクリーンショットで読む。**

```tsx
// main.tsx に一時的に。検証後に必ず削除する。
const c = document.createElement("div");
c.style.cssText = "position:fixed;inset:0;z-index:99999;background:#000;color:#0f0;font:11px monospace";
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(c));
const say = (s: string) => { c.textContent += s + "\n"; };

say("[1] この行が出ている = 検出器は生きている");          // ← 陽性対照を必ず 1 行目に
window.addEventListener("securitypolicyviolation", (e) => say(`[CSP-HIT] ${e.violatedDirective} -> ${e.blockedURI}`));
fetch("https://example.com/canary").catch(() => {});      // ← 必ずブロックされる撃ち込み
```

💡 **1 行目と「必ず失敗する撃ち込み」を必ず入れる。** これが無いと
「CSP-HIT が出ていない ＝ 違反が無い」と「検出器が黙っている」を区別できない。
実際、最初は `console.error` 版で撃って**全部空**だったので、危うく「違反なし」と読むところだった。

⚠️ **フォントの `document.fonts.check(font)` は既定のテスト文字が空白**なので、
`unicode-range` 分割だと空白の chunk が未ロードで **`false` を返す（測り方の artifact）**。
実文字を渡す（`check('24px "Noto Sans JP Variable"', "ファイル")`）。
⚠️ **幅比較で CJK は判定できない** —— 全角はどのフォントでも 1em 幅なので、
実在しない family と**同じ幅になる**（実測 288.0 vs 288.0）。Latin なら差が出る（140 vs 130）。

### macOS 側（m4air・2026-07-29 に確立）

`xdotool` / `import` は無い。代わりに **Accessibility API と `screencapture -R`** を使う。

```bash
open src-tauri/target/release/bundle/macos/DDRenamer.app
PID=$(pgrep -f 'bundle/macos/DDRenamer.app')

# ウィンドウ矩形・フォーカス・トラフィックライト位置を「測る」
osascript -e "tell application \"System Events\" to tell (first process whose unix id is $PID) \
  to get {position, size} of first window"

# ウィンドウ領域だけ撮る（全画面は他の作業が写り込む）
screencapture -x -R "<x>,<y>,<w>,<h>" shot.png
```

💡 **入力を受け取れているかは目で見なくても分かる。**
`AXFocusedUIElement` が **`AXWebArea`** なら WebView に届いている。**`AXWindow`** で止まっていたら
ウィンドウがキーになれていない。`AXCloseButton` が `nil` かどうかで `decorations` の実効値も読める。

⚠️ WKWebView の **DOM は AX ツリーに出てこない**（`AXManualAccessibility` が要る）ので、
ボタンやテキストフィールド単位の走査はできない。**ウィンドウ層までが AX で測れる範囲。**
