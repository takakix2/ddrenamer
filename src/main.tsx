import React from "react";
import ReactDOM from "react-dom/client";

/* フォントは**同梱**する（外へは出ない ＝ 完全オフラインで動く保証は変わらない）。
 * ⚠️ family 名は `Noto Sans JP Variable` / `JetBrains Mono Variable`（fontsource の規約）で、
 * Kit の `ui-kit/themes/_variables.css` のスタックがこの名前を先頭に置いている。
 * **ここの import を落とすと指定だけが残る** —— OS に同名フォントが在る機械では当たって
 * 見えるので、壊れていることに気づけない。Tabula / Alethoglyph と同じ字面にするための配線。 */
import "@fontsource-variable/noto-sans-jp";
import "@fontsource-variable/jetbrains-mono";

import "./index.css";
import "./i18n/config";
import { applyTheme, getInitialTheme } from "./theme";
import App from "./App";

// 🚨 **render より前に、React の外で**テーマを当てる。effect の中でやると
// 1 フレームだけ既定テーマが描かれて瞬く。`index.html` のインライン script は使えない
// （release では Tauri が nonce を付けるので CSP に弾かれ、しかも console が届かず気づけない）。
applyTheme(getInitialTheme());

// CSP 違反を目に見えるようにする。WebKitGTK は違反を console に出さないことがあり、
// 「外に出ようとして黙って止まった」が一番困る形なので、自前で拾って必ず鳴らす。
//
// 🚨 **release ではこの console.error は端末に届かない**（2026-07-30 実測: release バイナリを
// シェルから起動しても stdout/stderr に 1 行も出ない。dev / devtools 経由でしか読めない）。
// つまり **「release を起動して stderr が空 ＝ CSP 違反なし」とは言えない**。
// release で確かめたいときは、違反を **DOM に書き出す一時カナリア**を仕込んで
// スクリーンショットで読むこと（この方法で `font-src -> data` のブロックを実際に捕まえた）。
window.addEventListener("securitypolicyviolation", (e) => {
  console.error(
    `[CSP] blocked ${e.violatedDirective} → ${e.blockedURI} ` +
    `(${e.sourceFile ?? "?"}:${e.lineNumber ?? "?"})`,
  );
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
