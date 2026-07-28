import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// CSP 違反を目に見えるようにする。WebKitGTK は違反を console に出さないことがあり、
// 「外に出ようとして黙って止まった」が一番困る形なので、自前で拾って必ず鳴らす。
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
