import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;

const DEV_PORT = 1425;
const DEV_HMR_PORT = 1426;

/**
 * dev サーバにも CSP を届ける。
 *
 * Tauri の `csp` は custom protocol の応答に載るので release では効くが、`devUrl` が
 * vite を指している間 HTML を返すのは vite なので **Tauri には CSP を差す応答が無い**。
 * 配線しないと dev だけ CSP 不在になり、release で初めて壊れる（Tabula で出荷済みの罠）。
 *
 * 値は tauri.conf.json を正本として読む。ここに文字列を写すと二重管理になり静かにズレる。
 */
function devCspFromTauriConf(): Plugin {
  return {
    name: "dev-csp-from-tauri-conf",
    apply: "serve",
    transformIndexHtml(html) {
      const conf = JSON.parse(
        readFileSync(new URL("./src-tauri/tauri.conf.json", import.meta.url), "utf-8"),
      );
      const csp: string | null = conf.app?.security?.csp ?? null;
      if (!csp) return html;

      // dev サーバ由来の接続だけを足す（release には存在しないので正本には書かない）:
      // vite の HMR は WebSocket で繋ぐ。'self' が ws: を含むかは実装差があるので明示する。
      const hmrOrigins = host
        ? `ws://${host}:${DEV_HMR_PORT} http://${host}:${DEV_PORT}`
        : `ws://localhost:${DEV_PORT} ws://127.0.0.1:${DEV_PORT}`;
      const devCsp = csp.replace(/connect-src /, `connect-src ${hmrOrigins} `);

      return {
        html,
        // 'head'（末尾）に入れる。'head-prepend' だと <meta charset> より前に出て、
        // vite は Content-Type に charset を付けないので日本語 UI が dev でだけ化ける。
        // body の <script> より前なので、スクリプトには CSP が効く。
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: devCsp },
            injectTo: "head",
          },
        ],
      };
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), devCspFromTauriConf()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1425,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1426,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
