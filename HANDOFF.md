# DDRenamer — HANDOFF

> このファイルは**現在の状態**を持つ。経緯（なぜそうなったか）は
> `~/dev/agent-guidelines/logs/*-ddrenamer.md` にある。

最終更新: 2026-08-01（m4air で実機確認 + 署名/notarize を完了 ＝ **macOS 版は配れる**。
その後 blackcube で **入力欄の `Ctrl+Z` を解決** ＋ **Linux release でも操作確認**
＝ **両 OS とも release で通り、OS 間の非対称も消えた**）
直近の変更: **入力欄の `Ctrl+Z` / `Ctrl+Shift+Z` が Linux でも効くようになった**（下の解決済みセクション）。
**自前 undo スタックは書いていない** —— `document.execCommand('undo')` を繋いだだけ。
Linux を焼き直して release で実測済み（⚠️ **`~/.local/bin` の旧版も差し替えた**）。
その前（同日）: **macOS 実機で全項目が通った**（下の「macOS 実機確認」）。
⚠️ **前提が 1 つ崩れた** —— 「メニューが無いから `⌘C`/`⌘V` が効かないはず」は**誤り**で、
**Tauri v2 が macOS にだけ既定メニューを勝手に付けている**（`lib.rs` にコードは無い）。
その前（2026-07-31）: **Undo を実装**（バッチ単位・`Ctrl+Z`・ログバーのボタン）＋
**名前の番人を `join_name_ext` に集約**（空名バグを修正）＋
**上書き防止ガードを名前比較から実体の同一性判定へ**（大小違いのファイルを壊していたのを修正）。
**Linux / macOS 両方を焼き直し済み。**
その前（2026-07-30・2 回目）: **i18n (ja/en) とテーマ切替 (4 種) を実装**＋**設定モーダルを新設**。
その前（同日 1 回目）: **UI を Tailwind v4 から `Lethe_UI_Kit` へ移行**（Tabula / Alethoglyph と
ファミリー統一）＋**CSD 窓の窓操作を実装**（掴み・リサイズ・アイコン。どちらも「無かった」もの）。
その前: macOS の UI 無反応を修正（`1d89a15` まで壊れていた・下記の解決済みセクション）

---

## ✅ macOS 実機確認 — 完了（2026-08-01・m4air・`71408fc` のビルド）

**全項目が通った。** 積み残しだった「macOS で一度も操作されていない」は解消。
`71408fc..2cf6d0d` の差分は `HANDOFF.md` だけなので、**このビルドは現行 HEAD と同じコード**。

| 見たもの | 結果 |
|---|---|
| UI が操作できるか（`1d89a15` の無反応バグ） | ✅ タブ切替・文字入力・窓の掴み、すべて通る |
| 入力欄の `⌘C` / `⌘V` / `⌘X` / **`⌘Z`** | ✅ **4 つとも効く**（`⌘Z` も！ 下の「既定メニュー」） |
| アプリの Undo（`⌘Z` でリネームを戻す） | ✅ 名前も中身も復帰。連番カウンタも 4 → 1 に戻る |
| 窓のリサイズ（`Overlay` との兼ね合い） | ✅ 縁を掴んで `680x638` → `687x644`（AX 実測） |
| `⌘,` で設定モーダル | ✅ 開く |
| 長時間の安定性 | ✅ **19 時間 3 分生存・CPU 0.0%・クラッシュ無し** |

**Undo の検証（機械照合）**: `.txt` 3 件を連番リネーム → `⌘Z`。
名前が完全復帰し、中身も一致。⚠️ **ファイルの mtime は据え置きでディレクトリの mtime だけ進む**
——「`fs::rename` で往復した」証拠はここに出る（中身を書き換えていない証明にもなる）。
UI 側でも **↶ が薄く disabled に戻る**（戻した行を履歴に積み直していない ＝ 連打で往復しない）。

### 🚨 前提が 1 つ崩れた —— **Tauri v2 は macOS に既定メニューを勝手に付ける**

`lib.rs` にメニューのコードは **1 行も無い**のに、AX で覗くと全部在る:

```
メニューバー: Apple, DDRenamer, File, Edit, View, Window, Help
Edit の中身:  Undo, Redo, ―, Cut, Copy, Paste, Select All, ―, Writing Tools, ...
```

⇒ 「メニューを構築していないから `⌘C`/`⌘V` すら効かないはず」という読みは**誤り**だった。
Edit ロール一式が既定で入っており、WKWebView が undo manager を持つので `⌘Z` まで通る。

🚨 **だから「設定… `⌘,`」のメニュー項目を足すときは、既定メニューを潰さないこと。**
自前の `Menu` を `set_menu` で当てると**既定メニューは置き換わる**ので、素朴に
「設定だけの Menu」を作ると **Undo/Copy/Paste が全部消える**（今動いているものを壊す）。
`Menu::default()` から組み立てて項目を挿す形にすること。⚠️ 未検証・作業前に確かめる。

### ⏸ 残っているもの

- ✅ **署名・notarize は 2026-08-01 に完了**（下の専用セクション）。**配れる状態**。
- 🔴 **LICENSE が未決** —— README は `MIT License (or Unlicense)` の**まま**で、
  **LICENSE ファイルも無い**。公開するなら `(or)` を消して 1 つ選ぶ必要がある。
- 🔶 **配布先が未決**（`.github/FUNDING.yml` だけ在るので GitHub Releases が自然か）。
- **設定… `⌘,`** のメニュー項目（キーは効く・項目が無いだけ。上の 🚨 を読んでから）

---

## 🎯 次にやること（blackcube / Linux 側）

**macOS 側は片付いた**（上）。手は Linux に戻る。優先度順:

0. ✅ **入力欄の `Ctrl+Z`** —— **2026-08-01 に解決**（`execCommand` が効いた・下の専用セクション）
1. ✅ **Linux release ビルドでの動作確認** —— **2026-08-01 に完了**（下の「リリース成果物」）。
   ⇒ **両 OS とも release で操作確認済み**になった。残る未検証は Windows だけ

2. ✅ 🪟 **置けない名前の検査** —— **2026-08-01 に実装**（下に専用セクション）。
   **常に Windows の規則で弾く**方に倒した（ユーザー判断・`a:b.txt` は作れなくてよい）。

⇒ ✅ **空の名前 + 拡張子維持 で隠しファイルが作れる**（修正済・下に専用セクション）
⇒ ✅ **大小だけ違うファイルを黙って上書き**（修正済・下に専用セクション）

3. ✅ **LICENSE** —— **2026-08-01 に MIT で決定**（下に専用セクション）。第三者通知も**配布物に載せた**。

**残るのは 2 つだけ**:
- 🪟 **Windows を実際に焼く**（機械が無い・CI も無い。下の専用セクション）
- 🔶 **配布先の決定**（GitHub Releases が自然か。macOS の dmg は署名 + notarize 済みで配れる状態）

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
Tabula / Alethoglyph と**同じ実体**（`~/dev/Lethe_UI_Kit`）を指す。

📌 **2026-07-30: Kit が `Lethe_Appliance` の submodule から独立した。**
元々 Lethe のために作ったものなので submodule だったが、今は 5 つが使う共有物
（Tabula / Alethoglyph / DDRenamer / Lethe Web UI / lethe-client）。
**両機とも `~/dev/Lethe_UI_Kit` が実体**になった（以前は blackcube だけ symlink 経由・
m4air は元からこの形でアプライアンス自体を持っていない）。同日 Alethoglyph の
**絶対パス symlink も相対に直した** —— あれは移設で切れるところだった。

⚠️ **絶対パスで貼らないこと。** 機械ごとにツリーの形が違うと壊れる。しかも
**切れても Rust は起動する**ので、症状は「無言の白画面」になり原因に辿り着きにくい。

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

## リリース成果物

| プラットフォーム | 焼いた場所 | 成果物 |
|---|---|---|
| Linux x86_64 | blackcube | ✅ **2026-08-01 09:4x に焼き直し + release で操作確認済み**（入力欄 undo 入り・`b37a832`）: `deb 10.3M` / `rpm 10.3M` / `AppImage 82.2M`。**`~/.local/bin/ddrenamer` も差し替え済み**（⚠️ 差し替え前は **7-31 の旧版のまま**だった＝リポを直しても手元の道具には届いていなかった） |
| macOS **universal** | **m4air** | ⚠️ **署名 + notarize は済んでいるが、中身が古い**（2026-08-01 06:5x 焼き）。`spctl` は accepted / Notarized Developer ID だが、**同日午前の blackcube 分が入っていない** —— フロントが `index-BJXgqN6K.js`（入力欄 undo 前）で、`Reserved name` / `Invalid character` のリテラルが **0 件**（名前の検査前）。⇒ **配る前に焼き直し + 再署名 + 再 notarize が要る** |
| ~~macOS aarch64~~ | m4air | ⚠️ 2026-07-31 の `71408fc` 版（adhoc 署名・arm64 のみ）。**実機の操作確認はこれで行った**が、配布物としては上の universal 版が正。`target/release/bundle/` の方は**旧物なので破棄してよい** |
| Windows | — | ❌ **一度も焼いていない**（下の専用セクション） |

### 成果物が現行 HEAD かを確かめる型（2026-07-31 に確立）

**フロント側**: `strings` で release バイナリから **Vite の内容ハッシュ名**（`assets/index-*.js` /
`*.css`）を拾い、`vite build` し直した出力のファイル名と突き合わせる。内容ハッシュなので
**名前が同じ ＝ 中身が同じ**。cargo を回さずに済む。

**Rust 側**: 上の型は**フロントの同期しか見ていない**。Rust の変更が入ったかは別の印が要る。
効いたのは **今回入った依存クレートのシンボル**（`same_file` が release に 8 件）。
依存の追加とコード修正が同じコミットなら、cargo は片方だけ古い tree を作れないので証拠になる。

🚨 **release バイナリへの文字列検索は当てにならない。両方向で外す。**
- **フロントの文字列**: Tauri が埋め込みアセットを**圧縮**するので、在っても 0 件
  （`DDRenamer` という ASCII すら出てこない）
- **Rust のリテラル**: release では**在るはずの物まで 0 件になる**。2026-07-31 実測 ——
  `File not found` / `Invalid path` は**確かに生きている**（前者は「同じクリップボードで 2 回
  貼る」で実機観測済み）のにバイト列として見つからない。一方 `Target exists` /
  `Invalid filename` / `Success` は出る。**どれが残るか予測できない**ので、
  「出なかった ＝ 入っていない」と読んではいけない
- ⚠️ **debug バイナリでは全部出る**（254MB / release は 22MB）。debug で対照を取ると
  「release にだけ無い」が見えて、無い方を信じたくなる罠がある

⚠️ deb 内バイナリと `target/release/ddrenamer` の sha256 は **bundle 時の strip で一致しない**。

📌 **macOS では逆に、Rust のリテラルがほぼ残る**（2026-07-31 実測）。
`Name is empty` / `File not found` / `Target exists` / `Search string is empty` が全部 1 件ずつ出る
（Linux release では `File not found` すら 0 件だった）。シンボルも 32,108 個残っている。
⇒ **同じソースでもプラットフォームで残り方が違う**ので、Linux で覚えた読み方を持ち込まないこと。
⚠️ `same_file` は `strings` では 0 件だが **`nm` には 4 シンボル**。道具を変えると見える。

### macOS 版の状態（2026-07-31）

✅ **焼き直し済み**（`71408fc`・番人 + Undo 入り）。検証したところまで:

- フロントの内容ハッシュが blackcube と**一致**（`index-BJXgqN6K.js` / `index-BNc9HppS.css`）
- Rust の修正も入っている（上記のリテラルと `nm` の `same_file`）
- **起動して 41 秒生存 / CPU 0.0% / クラッシュレポート無し**、
  `lsappinfo` に `com.takaki2.ddrenamer` として登録
  （📌 **同じプロセスがそのまま 19 時間生きた**ことを 2026-08-01 に確認。放置安定性は十分）
- quarantine 属性は**無い**（ローカルビルドなので起動はする）

✅ **操作確認は 2026-08-01 に完了**（上の「macOS 実機確認」）。
📌 **`osascript` は tmux セッションからなら通る**（2026-07-31 の `-1728` は ssh セッション固有）。
ただし **AX で測れるのはウィンドウ層まで**なので、クリックや打鍵は人の手が要る。
⇒ **人が操作 → こちらが AX / `ls` / mtime で機械照合**、が実際に回った型。

- ✅ **署名は 2026-08-01 に解決**（旧: adhoc で `TeamIdentifier=not set`）。下の専用セクション。
- ✅ **UI 無反応（`1d89a15`）は解決済み**（下記セクション）。あの `.app` / `.dmg` は
  **操作不能なので破棄すること**。

### ✅ macOS 版を焼く手順（m4air・**署名 + notarize 込み**・2026-08-01 に確立）

```bash
ssh m4air
export PATH="$HOME/.bun/bin:$PATH"     # bun は PATH に無い。node/npm は存在しない
cd ~/dev/DDRenamer && git pull

export APPLE_SIGNING_IDENTITY="Developer ID Application: Takayuki Nine (K8K944Y32N)"
export APPLE_ID="<apple-id>"                # 🚨 実値を書き戻さないこと（下記）
export APPLE_TEAM_ID="K8K944Y32N"
export APPLE_PASSWORD="$(security find-generic-password -s 'TABULA NOTARIZE' -w)"   # 🚨 下記
bun run tauri build --target universal-apple-darwin

# 🚨 tauri は .app しか notarize しない。dmg は署名するだけで「2 bundles 完成」と言う
DMG=src-tauri/target/universal-apple-darwin/release/bundle/dmg/DDRenamer_0.1.0_universal.dmg
xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" \
  --password "$(security find-generic-password -s 'TABULA NOTARIZE' -w)" \
  --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$DMG"

# 外から確かめる（exit code を信じない）
spctl -a -vv -t open --context context:primary-signature "$DMG"   # → accepted / Notarized Developer ID
xcrun stapler validate "$DMG"                                     # → オフラインでも通る証拠
```

🚨 **`APPLE_ID` に実アドレスを書き戻さないこと。このリポは GitHub 側が public。**
2026-08-01 に一度書かれており、**push 前に履歴ごと `<apple-id>` へ置換した**
（後から修正コミットを足すだけでは、古い commit の blob が公開されて意味がない）。
値は m4air のローカルにだけ置く。⚠️ Team ID (`K8K944Y32N`) は**秘密ではない**
（署名済みバイナリすべてに入っている）ので、こちらは書いてよい。

📌 **コミットの author も揃えること。** m4air の git config は実アドレスを使っていて、
blackcube は綴り違い (`n.takkai@`) を使っている。**公開リポでは
`1370181+takakix2@users.noreply.github.com` に揃える**（本文を伏せても
コミットのメタデータから漏れるため）。両機の `git config user.email` を直しておかないと、
**次の push でまた同じことが起きる**。

🚨 **`APPLE_PASSWORD="@keychain:TABULA NOTARIZE"` と書いてはいけない。**
`notarytool` が解決に失敗し、**認証情報が正しいのに `HTTP 401 Invalid credentials`** で落ちる
（2026-08-01 に実測。項目名の空白が原因と思われるが未確定）。**実値を渡すこと**。
⚠️ **401 を「パスワードが失効した」と読まない。** 切り分けは `xcrun notarytool history` を
2 通りの渡し方で叩けば **5 秒**で付く（何も提出せずに認証だけ試せる）。

🚨 **`| tail` にパイプすると `$?` が `tail` の終了コードになる。** 実際 2026-08-01 に、
notarize が 401 で落ちているのに「exit 0」と記録しかけた。`set -o pipefail` を使うか、
ログをファイルに落として本体の `$?` を取ること。⇒ [[verify-positive-evidence-not-absence]] の系。

📌 **`rustup target add x86_64-apple-darwin` が要る**（universal ビルドのため。初回のみ）。
📌 ビルド時間は universal で **cold 5 分 / warm 2 分**（M4 Air・他の cargo と並行して）。

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

## ✅ 修正済: 名前の番人を `join_name_ext` に集約（2026-07-31）

2026-07-30 に見つかった **空の名前 + 拡張子維持 で隠しファイルが作れる**バグを直した。

**元の形**: 「リネーム」タブで名前を空のまま投入すると `photo_a.jpg` → **`.jpg`** に成功していた。
`Fixed` が `keep_ext` のとき `join_name_ext(name, ext)` を返すので、`name` が空でも
`".jpg"` という「空でない名前」になり、最後の番人 `if new_name.is_empty()` は
**完成した名前**しか見ないので素通りしていた。

**直し方**: `join_name_ext` を `Result<String, String>` にして、**その中で** stem の空を弾く。

```rust
fn join_name_ext(stem: &str, ext: &str) -> Result<String, String> {
    if stem.trim().is_empty() { return Err("Name is empty".into()); }
    ...
}
```

⚠️ **検査は join の前**に置く必要がある —— `Path::new(".jpg").file_stem()` は `Some(".jpg")` を
返す（dotfile 扱い）ので、完成後の名前を再分割しても空 stem は見えない。
`join_name_ext` 自身が「stem と ext が出会う 1 点」なので、**持ち回る形に変えなくても
そこが集約点になった**（HANDOFF は当初 `new_name_res` を stem/ext のまま持ち回る案を書いていたが、
それは不要だった）。

**効く範囲**: 呼び出し 6 経路（`Fixed` / `Serial` / `Add` / `Trim` / `Case` / `Convert`）＋
join 経由に載せ替えた `Extension`。

🚨 **ただし「6 つのバグを直した」ではない。** 実際に空 stem へ到達できるのは **`Fixed` だけ**:
- `Case` / `Convert` は長さを保つ
- `Add` は非空の stem の上に足す
- `Trim` は自前の番人 `Trim count (n) exceeds name length (m)` が先に弾く
- `Serial` は **`format!("{:0width$}", 0, width = 0)` が `"0"`** なので空にならない
  （テスト `serial_always_has_a_digit_so_it_never_hits_the_guard` が固定してある）

⇒ 集約の値打ちは**今の 1 件を塞ぐこと**より、**継ぎ目に不変条件が立ったこと**の方。
Windows 検査もここに足せば 6 経路に一度に効く。

📌 **空白だけの名前も弾く**（`stem.trim().is_empty()`）。`"   .jpg"` は Linux では作れてしまうが
Windows では不正で、そもそも誰も意図しない。

📌 **`Extension` の挙動が 1 つ変わった**: 拡張子欄を空にすると、以前は `photo.`（末尾ドット
＝ Windows で不正）になっていたが、join 経由になったので **`photo`** になる ＝「拡張子を外す」。

📌 `Replace` は**塞いでいない**。全体置換なので stem の概念が無く、`.gitignore` のような
正当な dotfile 作成と機械的に区別できないため（下の Follow-Ups 参照）。

### なぜ急いだか

この道具は **Undo が無い**（Pending にある）。速く投げられるということは**速く間違えられる**
ということで、機能を足すより**入口の番人**のほうが効く。しかもこのバグの結果は隠しファイルなので、
**ファイラから消えたように見える**（ログには成功と出る）。静かに壊れる形なのが悪い。

## ✅ 修正済: 大小だけ違うファイルを黙って上書きしていた（2026-07-31）

**元の形**: 上書き防止ガードが、同一ファイルかどうかを**名前を小文字化した文字列**で判定していた。

```rust
let old_lower = old_path.to_string_lossy().to_lowercase();
let new_lower = new_path.to_string_lossy().to_lowercase();
if old_lower != new_lower { return "Target exists" }   // ← 大小違いだと来ない
```

意図は正しい —— case-insensitive な FS（macOS / Windows）では `PHOTO.txt` → `photo.txt` の
とき `new_path.exists()` が**同一ファイル**に当たって真になるので、それを許したかった。
しかし **case-sensitive な FS（ext4）では `photo.txt` と `PHOTO.txt` は別々の実ファイル**で、
この判定では区別できない。結果、`fs::rename` が宛先を黙って置換し、**status は `Success`**。

🚨 **サイレントなデータ損失**。実測（ext4・`tempdir`）:

```
photo.txt (中身 VICTIM) と PHOTO.txt (中身 SUBJECT) が共存
PHOTO.txt に Case→Lower
  → status = "Success" / photo.txt の中身が SUBJECT に / VICTIM は消滅
```

⚠️ **開発機の Linux が一番危ない**。macOS / Windows は FS が case-insensitive なので通常は当たらない。

**直し方**: 綴りではなく**実体の同一性**を訊く。`same-file` クレート（Unix は `dev`+`ino`、
Windows はファイルインデックス）。**`Cargo.lock` に既に居た**（Tauri が walkdir 経由で引いている）
ので、追加の取得もビルドも発生しない（lock の差分は +1 行）。

```rust
if new_path.exists() {
    let is_self = same_file::is_same_file(old_path, &new_path).unwrap_or(false);
    if !is_self { return ... "Target exists" ... }
}
```

📌 `unwrap_or(false)` ＝ metadata が読めないときは「別物」に倒す ＝ **拒否側に落ちる**。

⚠️ **`fs::canonicalize` の比較は使わなかった。** case-insensitive FS で入力どおりの綴りを
返す保証がなく、**macOS で case-only リネームを塞ぐ**方向に倒れかねないため。

**回帰テスト 3 本**: 別ファイルを壊さない / 同一ファイルの case-only は通る /
無関係な既存ファイルへの上書きは従来どおり拒否。

## ✅ 解決: 入力欄の `Ctrl+Z` が Linux でも効く（2026-08-01）

**`document.execCommand('undo')` を繋いだだけ。自前 undo スタックは書いていない。**
`App.tsx` の keydown、**入力欄の early-return の中**（`Ctrl+V` と同じ土地）。

```tsx
if (!isMac && modifier && e.key.toLowerCase() === 'z') {
  if (document.execCommand(e.shiftKey ? 'redo' : 'undo')) e.preventDefault();
}
```

🚨 **「WebKitGTK は入力欄のテキスト undo を持っていない」は誤りだった**（2026-07-31 の結論）。
正しくは **キーバインドが無いだけで、editing command 経路には undo が在る**。
2026-07-31 の実測（uncontrolled 欄でも効かない）は事実だが、そこから
「実体が無い」と読んだのが飛躍だった。⇒ **「キーが効かない」と「機能が無い」は別の主張**。

**実測（blackcube・dev ビルド・DOM カナリアで読んだ）**:

| 打鍵 | 結果 |
|---|---|
| `"abcdef"` で `Ctrl+Z` | `exec=true` / `"abcdef" -> "abc"`（**打鍵の塊単位**で戻る）|
| 続けて `Ctrl+Shift+Z` | `exec=true` / `"" -> "abc"`（redo も往復する）|
| undo 後に再レンダー（トグルを叩く）| 値が**巻き戻らない** ＝ React の state も追従している |

📌 **controlled input でも壊れない。** `execCommand` が `input` イベントを発火するので
`onChange` が拾って state が更新される。**2026-07-31 に controlled input を疑ったのは的外れ**
だったが、結果的に「React は無関係」という結論だけは正しかった。

⚠️ **`document.queryCommandEnabled('undo')` で分岐しないこと。** **実行が成功する場面でも
`false` を返す**のを実測した（`exec=true` なのに `enabled=false`）。**戻り値で判断する**。
📌 失敗時に `preventDefault()` しないのは、既定の処理に道を残すため。

⚠️ **undo の粒度は WebKit が決める。こちらから制御できない。** 塊が割れるかどうかは安定せず、
**一度も途中で止まらずに打った名前は `Ctrl+Z` 一発で全部消える**（実測: `"photo_final"` → `""`）。
`Ctrl+Shift+Z` で戻せるので実害は小さいが、「1 文字ずつ戻る」と期待してはいけない。

🚨 **macOS では `!isMac` で閉じてある。** あちらは Tauri v2 の既定メニュー（Edit ロール）＋
WKWebView の undo manager で**既に効いている**ので、繋ぐと**二重に undo する**恐れしかない。
⇒ これで **`Ctrl+A` / `C` / `V` / `X` / `Z` / `Shift+Z` が両 OS で揃った**（非対称は解消）。

📌 **アプリの Undo（リネームを戻す）は無傷。** 変更したのは入力欄側の分岐だけ。
end-to-end で確認済み: 貼り付けで `a.txt` → `photo_final.txt`、欄の外で `Ctrl+Z` → `a.txt` に復帰し
**md5 一致**（中身も無傷）。

✅ **release でも測り直した**（2026-08-01・下記）。dev と同じ挙動。

### ✅ Linux release での再確認（2026-08-01）

**成果物が現行 HEAD かを先に固定した。** フロントだけの変更なので、確かめる印は
**Vite の内容ハッシュ**で足りる（Rust は無変更なのでシンボルの印は要らない）:

```
dist:      index-CdnfehbV.js / index-BNc9HppS.css
バイナリ:  assets/index-CdnfehbV.js / assets/index-BNc9HppS.css   ← 一致
旧 index-BJXgqN6K の残り: 0 件                                    ← 陰性側も見た
```

📌 **CSS のハッシュが前回と同じ**（`index-BNc9HppS.css`）なのは正しい —— CSS は触っていない。
**片方だけ変わる**のが期待どおりの絵で、両方変わったら余計な物が入っている。

**実測（release バイナリを起動して操作）**:

- ✅ 入力欄の undo: `"photo_rel"` → `"photo"`、別の回で `"photoxxyy"` → `"photoxx"`
- ✅ redo: `""` → `"photo"`、`"photoxx"` → `"photoxxyy"`
- ⚠️ **redo が戻らない回を 1 度観測した**（undo の直後に押したのに何も起きなかった）。
  再現条件を詰め切れていない。**undo は毎回効いたので実害は小さい**が、
  「redo は必ず往復する」とは書けない。WebKit の undo スタックの都合でこちらから制御できない。
- ✅ アプリの Undo（end-to-end）: 貼り付けで `a.txt` → `released.txt` → `Ctrl+Z` → `a.txt`、
  **md5 一致**。戻した後は ↶ が薄く disabled に戻る（戻した行を履歴に積み直していない）。

🚨 **`~/.local/bin/ddrenamer` は 7-31 の旧版のまま座っていた**（`index-BJXgqN6K.js` が焼かれていた）。
リポとリリースを直しても**手元で実際に起動する道具には届いていない**。差し替え済み。
⇒ 焼いたら **インストール先のハッシュも見る**こと（[[repo-is-not-what-users-get]]）。

### 🚨 測るときに踏んだ穴 2 つ

- **`console.log` は dev でも端末に届かない。** release だけの話だと思っていたが、
  `bun run tauri dev` の出力にも 1 行も出ない。⇒ **DOM カナリアは dev でも要る**。
  最初 `console.log` で測って「何も出ない」を見ており、**陽性対照が無ければ
  「効かなかった」と誤診していた**（実際には検出器が黙っていただけ）。
- 🚨 **HMR は古いリスナーを生かしたまま新しいリスナーを足す。** 計器付きの版と外した版が
  同時に走り、`Ctrl+Z` 一回で **undo が二重に走った**（`"photo_final" -> "abc"` という
  説明の付かない遷移が出る）。⇒ **`window.addEventListener` を張る変更を実機で測るときは、
  HMR に頼らず dev プロセスごと入れ替える**こと。

## ✅ 実装: 置けない名前を弾く（2026-08-01）

**常に Windows の規則で弾く。** OS で切り替えると、Linux で作った名前が Windows で開けない
という形で**跨いだ後に**壊れる ＝ 原因のリネームから遠く離れた場所で気づくことになる。
代償として **`a:b.txt` はこの道具では作れなくなった**（ユーザー判断で受け入れ済み）。

`src-tauri/src/lib.rs` の `check_portable_name`:

| 弾くもの | status |
|---|---|
| `< > : " / \ | ? *` | `Invalid character ':'`（当たった文字を出す）|
| 制御文字 | `Control character in name` |
| 末尾のドット / 空白 | `Name ends with a dot or space` |
| 予約デバイス名（`CON` `PRN` `AUX` `NUL` `COM1-9` `LPT1-9`・大小無視）| `Reserved name 'CON'` |

📌 **予約名は最初のドットより前で判定する** —— Windows では `CON.txt` も `CON` なので。
`.gitignore` は先頭が空文字列になるので巻き込まれない。

### 🚨 番人は `join_name_ext` ではなく**完成した名前**に置いた

HANDOFF は当初「`join_name_ext` の中に足せば stem 系 6 経路に一度に効く」と書いていたが、
**`join_name_ext` は唯一の継ぎ目ではなかった**:

- **`Fixed` は `keep_ext` が false（または拡張子が無い）とき `Ok(name.clone())` で直行する**
- **`Replace` は名前全体を書き換える**ので、そもそも stem に割らない

⇒ join に置くと**この 2 つが素通り**する。`handle_rename` の最後（`new_name` が出来た地点）に
置けば**全モードが必ず通る**。空名の番人が join に在るのはそのままでよい
（あちらは「join の前でないと見えない」という別の理由が在る・上のセクション）。

### 🚨 `/` は Windows の話ではなく **Linux の実害**だった

完成した名前は `parent.join(&new_name)` に渡る。つまり **`/` を含む名前は
「リネーム」ではなく別ディレクトリへの移動**になる。ガードを外して回帰テストを走らせると、
`sub/moved` を指定したファイルが**実際に `sub/` の中へ消えて `Success` が返る**ことを確認した。
⇒ この修正は移植性の下準備であると同時に、**今日の Linux で在ったバグを塞いでいる**。

### 意図的に受け入れた副作用

**既に不正な文字を持っているファイルは、その文字を残す操作ができなくなる。**
`a:b.txt` に `Add` や `Case` を当てると `Invalid character ':'` で弾かれる。
逃げ道は在る —— **`Replace` で `:` を消すか、`Fixed` で名前ごと置き換える**方は通る。
「移植できない名前を新しく作らない」という規則としては一貫している。

**回帰テスト 3 本**（`cargo test` 22 本すべて緑）:
関数の契約 / `/` でファイルが逃げないこと / **join を迂回する 2 モードも捕まえること**。
📌 **ガードを外すと後ろ 2 本が落ちることを確認済み**（当たっているテストである証拠）。
関数の契約テストだけは直呼びなので落ちないのが正しい。

## ✅ 決定: ライセンスは MIT（2026-08-01）

**`LICENSE` = MIT / `Copyright (c) 2026 Takayuki Nine`。**
README の `MIT License (or Unlicense)` は**削除した** —— 2 つ併記したまま配ると、
受け取った側がどちらの条件で使えるのか判断できない。

📌 **名義は macOS の署名（`Developer ID Application: Takayuki Nine`）と揃えてある。**
同じ配布物の中で名義が 2 つあると「同一人物か？」という余計な問いを生むため。

### 🚨 MIT だけでは足りない —— 同梱フォントが OFL-1.1

`noto-sans-jp` / `jetbrains-mono` は **OFL-1.1** で、しかも**バイナリに焼き込んでいる**
（2026-07-30 の同梱判断）。**アプリを配る ＝ フォントを配る**なので、OFL の要求により
**ライセンス表記がバイナリと一緒に旅する必要がある**。

⇒ `THIRD-PARTY-NOTICES.md`（OFL 全文 + 依存の一覧）を置き、
**`tauri.conf.json` の `bundle.resources` で配布物に載せた**。

```json
"resources": { "../LICENSE": "LICENSE",
               "../THIRD-PARTY-NOTICES.md": "THIRD-PARTY-NOTICES.md" }
```

🚨 **リポに置くだけでは未達だった。** 宣言する前の deb を `dpkg-deb -c` で見ると
**ライセンスファイルが 1 つも入っていない**。Tauri の bundle は**宣言した物しか入れない**ので、
「リポに LICENSE を置いた」は OFL の要求を満たさない。
⇒ [[repo-is-not-what-users-get]]（同じ日に `~/.local/bin` の方でも踏んだ）。

**確認済み**: `deb` と `AppImage` の両方に `usr/lib/DDRenamer/LICENSE` と
`THIRD-PARTY-NOTICES.md` が入っていること。
⏸ **`rpm` は未確認**（このマシンに `rpm` / `rpm2cpio` が無い）。同じ `resources` 設定なので
入っている見込みだが、**見ていないものは見ていない**。
⏸ **macOS の `.app` / `dmg` も未確認**（次に焼くときに `Contents/Resources/` を見ること）。

### 依存のライセンス（機械で数えた・`cargo metadata`）

**463 クレート全部が申告済み・GPL はゼロ。** 大半が `Apache-2.0 OR MIT`（258）と `MIT`（116）。

⚠️ **MPL-2.0 が 5 件**（`cssparser` / `cssparser-macros` / `dtoa-short` / `option-ext` /
`selectors`）。**無改変の依存**なので DDRenamer 自身のライセンスには影響しないが、
ファイル単位の弱いコピーレフトなので**入手先を通知に明記**してある。

📌 **通知は手書きせず `cargo metadata` + `package.json` から生成した**（`cargo-about` は未インストール）。
⚠️ **依存を変えたら生成し直すこと** —— 腐った通知ファイルは、無いより悪い（点検済みに見えるので）。
📌 生成時に `MIT/Apache-2.0` と `MIT OR Apache-2.0` を**同じ行に畳んでいる**。
畳まないと同じ許諾が 2 行に割れて、集計が雑に見える。

## 🪟 Windows: CI を置いた（2026-08-01）— **初回で 1 件見つけた**

LAN に Windows 機が無いので **GitHub Actions (`windows-latest`)** に置いた
（`.github/workflows/windows.yml`）。Gitea には runner が居ないので CI は GitHub 側にしか置けない。
狙いは installer より **テストを実 Windows のファイルシステムで走らせること**。

### ✅ 現在: **緑**（`30680237956`）。Windows の成果物が初めて焼けた

```
DDRenamer_0.1.0_x64_en-US.msi
DDRenamer_0.1.0_x64-setup.exe     ← artifact "windows-bundles" (16MB)
```

**22 テスト全通過。** 実 Windows で初めて確かめられたこと:

- ✅ **case-only リネームは本当にディスクに載る**（`read_dir` が `PHOTO.txt` を返す）。
  これは今日まで**どのプラットフォームでも未検証**だった —— テストは `res.new_name`
  という**自分が計算した値**を見ていただけで、`Path::exists()` は case-insensitive では
  両方の綴りに真を返すので判定に使えない
- ✅ 移植性の名前検査が、**実際にその名前を拒否する OS** の上で通った
- ✅ `case_only_rename_does_not_destroy_a_distinct_file` は理由付きで skip
  （ログに `skipped: this filesystem is case-insensitive...` が出ている ＝ 黙って消えていない）

⏸ **触ってはいない。** msi / exe が焼けただけで、**実機で操作した人はまだ居ない**。

### そこに至るまでに CI が見つけた 2 件

**① 21 通過 / 1 失敗 —— 失敗はガードではなくテストの前提だった**

```
case_only_rename_does_not_destroy_a_distinct_file ... FAILED
  expected a refusal, got "Success"
```

このテストは `photo.txt`(VICTIM) と `PHOTO.txt`(SUBJECT) を**同じディレクトリに並べて**、
別ファイルを壊さないことを見る。だが **case-insensitive な FS では 2 つを同時に作れない** ——
2 回目の `write` は同じファイルを上書きするだけ。⇒ **シナリオ自体が構築できず**、
残った 1 個への case-only リネームは**正しく `Success`** になる。**ガードは正しい。**

🚨 **このテストは macOS でも同じ理由で落ちる**（macOS も既定で case-insensitive）。
**ext4 でしか走らせていなかったので今まで露見しなかった** —— m4air で `cargo test` を
走らせていれば同じ失敗が出ていたはず。

**直し方**: `cfg(windows)` で分岐**しない**。macOS は Unix かつ case-insensitive、
Linux も case-insensitive でマウントできるので、**ターゲット三つ組では答えが出ない**。
`filesystem_is_case_sensitive()` で**目の前の FS に訊いて**、作れない環境では理由付きで skip する。
📌 ext4 では skip されずに実際に走ることを確認済み（skip が常時発動して緑になる罠の陰性対照）。

**② 🚨 このリポは fresh clone からビルドできなかった**

`src/ui-kit` が **symlink としてコミット**されていて、指す先はリポの外（`../../Lethe_UI_Kit`）。
CI は fresh clone なので `tsc` が `CustomSelect` を解決できずに落ちた。
⇒ **GitHub は public なので、誰が clone してもビルドできない状態だった。**

📌 **fresh clone で壊れるのは 2 回目**（1 回目は `.gitignore` の `*.png` がアイコン 44 枚を
飲んでいた件）。**「周りのツリーが在る機械でだけ動く」**がこのリポの持病。

**直し方**: `Lethe_UI_Kit` を **GitHub に public ミラー**（`takakix2/Lethe_UI_Kit`）し、
`src/ui-kit` は追跡から外して **`postinstall`（`scripts/setup-ui-kit.ts`）が用意する**:

| 状況 | すること |
|---|---|
| 既に使える | 触らない |
| 隣に `Lethe_UI_Kit` が在る | **symlink**（Kit を直すと 5 アプリに即反映、を温存） |
| どちらも無い | ミラーから `--depth 1` clone |

⚠️ **判定は「ディレクトリが在るか」ではなく中の実ファイル**（`themes/_variables.css`）を見る。
**壊れた symlink は `existsSync` を単体では通る** —— それが CI を壊していた状態そのもの。
⚠️ **symlink をコミットに戻さないこと**（`.gitignore` に理由付きで書いてある）。
⚠️ ローカルは `master` / ミラーは `main` と**ブランチ名が違う**ので、Kit 側に
`remote.github.push = refs/heads/master:refs/heads/main` を固定してある。押し間違え防止。
📌 **検証**: 隣に Kit が無い場所へ fresh clone → `bun install` → `bun run build` を通し、
出力の内容ハッシュが開発機と**一致**することまで確認した（ミラーの中身が同一である証拠）。
⏸ **借金**: Kit は `node_modules/` を 26M コミットしており、ミラーにもそのまま出ている。

⚠️ **CI が緑でも「使える」証明にはならない。** Windows は Linux と同じ自前 CSD に乗るので、
macOS の `1d89a15`（描画は完全なのに全操作が無反応）と同じ事故が起こりうる。**実機の手が要る。**

## 🪟 未着手: Windows の実機確認（**焼けても触っていない**）

「マルチ OS で作っていた」つもりだが、**Windows のビルドは一度も走っていない**。

| | 状況 |
|---|---|
| 焼ける機械 | ❌ **LAN に Windows 機が無い**（blackcube / m4air / macmini） |
| CI | ❌ **無い**（`.github` にあるのは `FUNDING.yml` だけ） |
| 設定 | ✅ `bundle.targets: "all"` なので設定上は焼ける |
| コード | ✅ `cfg(target_os)` 分岐ゼロ / フロントの OS 分岐も `isMac` だけ |

**形としては合っている見込み**: Windows は Linux と同じ経路（`decorations: false` + 自前の
窓操作）に乗る。− □ ✕ を右上に描くのは Windows の作法と一致するので、CSD はむしろ素直。

🚨 **確実に踏むのは「名前として置けない文字」の検査が無いこと。**
Windows の禁止文字は `\ / : * ? " < > |`、予約名は `CON` `PRN` `AUX` `NUL` `COM1-9` `LPT1-9`、
さらに**末尾のドット・空白**も置けない。**`lib.rs` に文字の検査は一切ない**（`sanitize` 相当なし）。
Linux で禁止なのは `/` と NUL だけなので、**同じ操作が OS によって通ったり通らなかったりする**。
今は `fs::rename` が OS エラーを返し、それが生のままログに出るだけ（クラッシュはしない）。

📌 **上の「空の名前」バグと同じ継ぎ目**（`join_name_ext` の前後）なので、番人を 1 箇所に
集約するときに**一緒に入れるのが自然**。⚠️ ただし**検査を OS で切り替えると、Linux で作った
名前が Windows で開けない**という別の非対称が生まれる。**常に Windows の規則で弾く**ほうが
移植性のある名前になる（この道具の用途からするとそちらが妥当に見えるが、未判断）。

**焼く手段**: Gitea には runner が居ないので CI を置くなら **GitHub Actions** 側になる
（`windows-latest` で `tauri build`）。⚠️ `tauri.windows.conf.json` を足す場合は、
macOS 側と同じ **JSON Merge Patch の配列丸ごと置換**の罠を踏む（下の該当セクション参照）。

## Pending（要件定義書 §4 より）

- [ ] **名前の交換 (Swap)** — 2 ファイル名の入れ替え（一時ファイル経由の 3 段階リネーム）
- [x] **Undo** — 2026-07-31 実装（下の専用セクション）
- [ ] **サウンド通知** — 完了時の SE
- [ ] **多重拡張子対応** — `.tar.gz` などの正確なパース

## 🔙 Undo ✅（2026-07-31 実装・実機確認済み）

**なぜ要るか**: 芯は安全ではなく **試行のコスト**。「間違えても大丈夫」ではなく
**「当てなくていい」**。出してみて気に入らなければ戻す、が速く回るとリネームが実験になる。

📌 ターミナルの安全策は**予行**（`mv -n` / `rename -n` / `zmv -n`）で、これは
「パターンを書き間違えた」には効くが「**パターンは正しかったが、やりたいことが違った**」には
効かない —— 予行の出力から正しさを**予測する**作業だから。こちらは結果を見てから決められる。
⇒ 「ターミナルより安全」ではなく「**予測しなくていい**」が売りの形。
`迷わない、広い、速い` に **取り消せる** が並ぶ。

🚨 **今日の番人はこの前提条件だった。** リネームが黙って上書きする道具は Undo を名乗れない
（潰されたファイルは戻せないので「取り消せます」が嘘になる箇所が残る）。
`handle_rename` を迂回した瞬間に土台が抜ける。

⚠️ **正直な限界**: 履歴はセッション内・メモリ上でバックアップの代わりにならない。
ZFS スナップショットや git を持っている使い手は、もっと強い網を既に持っている（重いけれど）。

❌ **「Undo したら同じファイルを掴んだままにする」は却下**（2026-07-31 に検討して捨てた）。
戻した直後に再投入が楽になるが、**見えない状態が 1 つ増える**。この道具は「投げた物が対象で、
それ以外に対象が無い」から迷わない。裏で保持すると「今なにが入っている？」を考えることになり、
`迷わない` を削る。**ドロップゾーンが空であること自体が情報**。もう一度ドロップする方が分かりやすい。

### 決めたこと

| 論点 | 決定 |
|---|---|
| 粒度 | **直前のバッチ**（1 ドロップ = 1 バッチ）。押す度に 1 つ前へ遡る |
| 席 | **`.logbar-actions`**（歯車の隣） |
| キー | `Ctrl+Z` / `⌘Z` |
| 部分失敗 | **戻せるものだけ戻し、全件をログに出す**（既存の 1 件ずつ判定と揃える） |
| 履歴の寿命 | **メモリ上のみ**（終了で消える） |

**席の理由**: ログバーの**ヘッダは畳んでいても見える**。Undo が要るのは*やらかした直後*で、
そのときバーはまず畳まれている。本文に置くと**一番要るときに隠れる**。
歯車をタイトルバー右でなくここに置いた理由（OS で姿が変わる土地を避ける）がそのまま当てはまる。

**履歴をメモリに留める理由**: 永続化すると「起動したら知らないファイルを戻せると言ってくる」
状態を扱うことになり、別物の設計になる（外で動かされた後の整合も要る）。

### 実装の要点

**Undo に専用コマンドは無い。** 戻すとは元のフルネームへのリネームなので、
`Fixed { name: <元のフルネーム>, keep_ext: false }` を `handle_rename` に当てるだけ。
これで**リネームと同じ番人**（同一性判定・上書き拒否）を必ず通る。
🚨 **独自の戻し処理を書かないこと** —— 迂回した瞬間に今朝直したサイレント上書きが復活する。
契約はテスト 3 本（往復 / 戻し先が埋まっている / 大小のみ）で固定してある。

| どこ | 何 |
|---|---|
| `RenameResult.new_path` | 成功時の着地先（絶対パス）。フロントが区切り文字を推測して組み直さないため |
| `undoHistoryRef` | `UndoBatch[]`（直近 **20** バッチ）。`canUndo` はボタン活性用の写し |
| `undoLast()` | バッチを 1 つ取り出して**元の順序で**戻す |
| ボタン | `.logbar-actions` の歯車の左・`Undo2`・`disabled` は Kit の作法（`opacity .5` + `not-allowed`）|
| キー | `Ctrl+Z` / `⌘Z`（**入力欄の early-return より後**）|

### 🚨 踏んではいけない穴（実装後も有効）

1. **Undo 自身がリネーム。今日入れた番人を必ず通すこと。**
   戻し先が埋まっていることがある（別のファイルが座った / 手で作られた）。素の `fs::rename` で
   戻すと **今日直したサイレント上書きを Undo が再発明する**。大小だけ違う戻しも同じ経路なので、
   `same_file` の同一性判定も要る。⇒ **`handle_rename` と同じ継ぎ目を通す**
2. **`status` から新しい名前をパースし返さないこと。**
   今の `LogEntry` は `status: "-> IMG_001.jpg"` という**表示文字列に結果を畳み込んでいる**
   （`App.tsx:262`）。構造化された `new_name` は捨てられている。
   ⇒ **`LogEntry` に `old_path` / `new_path` / `batch_id` を持たせる**方が先。
   表示文字列は表示のためだけに使う
3. **`Ctrl+Z` は入力欄と食い合う。** 名前欄で打ち間違えたときの `Ctrl+Z` は「文字を戻す」で
   あって「リネームを戻す」ではない。`Ctrl+V` が既に
   「入力欄にフォーカスがあれば素通し」で同じ問題を解いているので、**その作法をそのまま使う**
   （[[連番タブで Ctrl+V が効かない]] の follow-up と同じ土地なので、片方を触るときに両方見ること）
4. **Undo の結果も 1 件ずつログに積む。** 黙って半分戻すのが最悪。
   ⚠️ 戻した行を積むと、その行がまた Undo の対象に見える。**Undo が生んだ行は履歴に積まない**
   （でないと ↶ を連打すると元に戻ったり戻らなかったりする）

### 要る訳文（ja/en 両方・`check:locales` が落ちる）

`logbar.undo`（ボタンの title）のみ。**要約行は出さない** ——
リネームが 1 件 1 行で報告するので揃えた。ログ本文は英語レーンのままで、追加の訳文が要らない。

### 実機で確かめたこと（2026-07-31・dev ビルド）

連番タブで 3 件リネーム → `Ctrl+Z`。⚠️ **`xdotool` では OS の D&D を再現できない**ので、
`xclip -t text/uri-list` でクリップボードにファイルを積んで `Ctrl+V` の経路で流した。

- ✅ 名前も**中身**も元通り
- ✅ 連番カウンタが **4 → 1** に復帰（進んだままだと再挑戦がずれる）
- ✅ ログは 1 件 1 行（`Img_003photo_c.jpg → photo_c.jpg`）
- ✅ 履歴が空のとき薄く disabled / 積むと点灯 / 空で `Ctrl+Z` は無害
- ✅ **入力欄での `Ctrl+Z` はリネームを戻さない**
- ✅ ボタン経路もキーボードと同じ

⚠️ **ログバーの展開でボタンの y 座標が動く**（畳=615 / 開=397）。
座標を焼いたまま押すとログ行を叩いて「効かない」と誤読する（実際に一度踏んだ）。

## Follow-Ups

- 🔶 **配布判断。** ✅ 両 OS とも release ビルドで操作確認まで済んだ
  （macOS: 2026-08-01 早朝・m4air / Linux: 同日 09:4x・blackcube）。
  🚨 **ただし macOS の成果物は古い。** 署名 + notarize が通っているのは **06:5x に焼いた版**で、
  同日午前の blackcube 分（入力欄 undo / 名前の検査 / ライセンス同梱）が**入っていない**。
  Linux は焼き直したが macOS は焼いていないので、**今 2 つの OS で中身が違う**。
  ⇒ 配るなら **m4air で焼き直し → 再署名 → 再 notarize → staple** をやり直すこと。
  📌 **これが今日 3 度目の「成果物 ≠ リポ」**（1: `~/.local/bin` の旧バイナリ、
  2: bundle にライセンスが入っていなかった、3: これ）。[[repo-is-not-what-users-get]]
- 🔶 **投げる前に止める（要検討・2026-07-31 に提起）。** 空名の番人は Rust 側に立ったが、
  UI は**ドロップを受け付けてから 1 件ずつ拒否する**（5 個投げると `Name is empty` が 5 行並ぶ）。
  投げる前に分かる形（名前が空ならドロップゾーンを非活性 / 縁を警告色に）の方が親切ではあるが、
  どう見せるかは未決。
  - 🚨 **Rust 側の番人は残すこと。** UI が唯一の番人になると、経路が増えたとき
    （CLI・別モード・将来の Undo）に静かに穴が開く。UI は**先に知らせる**役で、
    **弾く**役ではない
  - 📌 対象は `fixed` タブだけではない。`extension` タブの空欄は今は「拡張子を外す」という
    **正当な操作**なので、非活性にする条件はタブごとに違う
- 🔶 **`Replace` だけ空名の番人を通らない。** 全体置換なので stem の概念が無く、
  `photo_a.jpg` に `photo_a` → `""` を当てると **`.jpg`** になる（`Fixed` で塞いだのと同じ結果に
  別経路で着く）。⚠️ **塞ぐと `.gitignore` のような正当な dotfile 作成も巻き込む**ので、
  「元が dotfile でないのに結果が `.` で始まる」を検出する形が要る。2026-07-31 に**意図的に保留**。
- ✅ **入力欄の `Ctrl+Z` / `Ctrl+Shift+Z`** —— **2026-08-01 に解決**（専用セクションへ）。
  dev / release の両方で確認済み。⚠️ **redo だけは「必ず往復する」と書けない**（1 度戻らない回を観測）。

- 🔶 **Kit の `--layer-1` が宙ぶらりん**（`_settings.css` が参照するのに定義が無い）。
  DDRenamer は `_settings.css` を避けて回避したが、**Lethe Client 側は透明な背景で出ているはず**。
  Kit に 4 テーマ分の定義を足すのが筋だが、横断変更（lethe-client / Tabula / Alethoglyph）なので
  今回はやっていない。`.custom-select-container` の 3 重複と**同じ性質の借金**。
- 🔶 **連番タブでは `Ctrl+V` がリネームを起こさない。** タブを開くとプレフィックス入力が
  **自動フォーカス**され、`Ctrl+V` は「入力欄にフォーカスがあれば素通し」の早期 return に当たる。
  設計としては正しい（欄に貼れないと困る）が、**このタブだけ貼ってもリネームされない**のは
  説明が要る挙動。D&D は影響を受けない。今回の変更で入ったものではない。
- ✅ **macOS でリサイズハンドルを描かない判断は正しかった**（2026-08-01・m4air で実測）。
  `decorations: true` のネイティブの縁を掴んで `680x638` → `687x644`。`Overlay` とも喧嘩しない。
- 🔶 **`.custom-select-container` / `-value` / `-icon` の 3 ルールが Kit に無い。**
  Kit は `components/tsx/CustomSelect.tsx` を配っているのに CSS を持たないので、
  **Tabula (`style.css:259`) / Alethoglyph (`App.css:678`) / DDRenamer (`App.css`) が
  同じものを 3 箇所で書いている**。Kit の `_inputs.css` に上げるべきだが、
  横断変更（lethe-client / Lethe Web UI も巻き込む）なので今回はやっていない。
- ✅ **署名 / notarize は完了**（2026-08-01・上の「macOS 版を焼く手順」）。
  Developer ID + Hardened Runtime + セキュアタイムスタンプ + staple まで通り、
  **quarantine 属性を貼った dmg でも `accepted`**（＝ダウンロードした人の経路を再現して確認）。
  `stapler validate` も通るので**オフラインでも起動する**。
  🔴 **残るのは LICENSE と配布先だけ**（コードを書かない仕事）。
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
