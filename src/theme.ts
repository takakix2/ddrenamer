/**
 * テーマ。**実体は Lethe_UI_Kit が持っている** —— `ui-kit/themes/_lethe.css` が
 * `[data-theme="lethe"|"dark"|"light"|"cyber"]` の 4 ブロックを 1 ファイルで配っていて、
 * `index.css` が既に取り込んでいる。だからこちら側の仕事は **属性を書き換えるだけ**。
 *
 * 🚨 **`App.css` に hex / rgba を直接書かないこと。** 4 テーマ全部に定義がある `var(--*)` を
 * 経由している限りテーマは丸ごと効くが、1 箇所でも直書きするとそこだけ元の色で残る
 * ＝ **切り替えが半分だけ効く UI** になる（実測: 現状 hex 0 件 / rgba 0 件、
 * App.css が使う色トークン 17 個は 4 テーマすべてに定義済み）。
 */
export const THEMES = ["lethe", "dark", "light", "cyber"] as const;
export type Theme = (typeof THEMES)[number];

const THEME_STORAGE_KEY = "ddrenamer-theme";

function isTheme(v: string | null): v is Theme {
  return v !== null && (THEMES as readonly string[]).includes(v);
}

export function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(saved) ? saved : "lethe";
}

/**
 * ⚠️ **初期適用は React の外（`main.tsx`）から、render より前に呼ぶ。**
 * effect の中でやると 1 フレームだけ既定テーマが描かれて瞬く。
 *
 * 🚨 **`index.html` にインライン `<script>` を置く手は使えない。** release では Tauri が
 * `script-src` に nonce を付けるので、CSP 仕様上 `'unsafe-inline'` が無視され、
 * 自分で書いたインラインは**弾かれる**。しかも release は console が端末に届かないので、
 * 弾かれたことに気づけない。だから外部ファイル（このモジュール）でやる。
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}
