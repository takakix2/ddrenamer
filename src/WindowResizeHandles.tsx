import type React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 窓の縁をリサイズできるようにする 8 枚の透明なハンドル。
 *
 * 🚨 **`decorations: false` の窓には縁が無い。** ネイティブの枠が無いので、OS は
 * 「端に近づいたらカーソルを変えて掴ませる」仕事をしてくれない ＝ **自前で置くしかない**。
 * DDRenamer にはこれが 1 枚も無く、端でカーソルが変わらなかった（2026-07-30 の報告）。
 *
 * ⚠️ **カーソルは native キーワードで指定する**（`ew-resize` 等・CSS は `App.css` 側）。
 * `url(...)` の png カーソルは **WebKitGTK が GDK_SCALE でスケールしない**ので、
 * HiDPI では極小になって「微妙にしか変わらない」表示になる（Tabula が 2026-06-21 に
 * 丸一日かけて出した結論）。
 *
 * 💡 **角で「ホバーは大きいカーソル → ドラッグ中は小さい」と跳ねることがあるが、これはアプリの
 * バグではない。** system のカーソルテーマ（blackcube は `whiteglass`）が
 * モダンな `nwse-resize` / `size_fdiag` を持たず古い X11 名しか無いため、ホバー時は
 * webkit が大きい既定カーソルに落ち、ドラッグ中はコンポジタ (mutter) が自前で正しく解決する。
 * **CSS から直す余地はほぼ無い**（標準テーマ Adwaita/Yaru なら出ない）。
 */
type ResizeDirection =
  | "North" | "South" | "West" | "East"
  | "NorthWest" | "NorthEast" | "SouthWest" | "SouthEast";

const HANDLES: ResizeDirection[] = [
  "North", "South", "West", "East",
  "NorthWest", "NorthEast", "SouthWest", "SouthEast",
];

// direction → CSS クラスの語尾（NorthWest → north-west）
const slug = (d: ResizeDirection) => d.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

export default function WindowResizeHandles() {
  const startResize =
    (direction: ResizeDirection) => async (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      // ドラッグ中の文字選択を止める。⚠️ **カーソルはここでは制御できない**
      // （native handoff 中はコンポジタが所有する）。App.css の注記を参照。
      document.body.classList.add("is-resizing");
      try {
        await getCurrentWindow().startResizeDragging(direction);
      } catch (err) {
        // ⚠️ release ではこの console は端末に届かない（main.tsx の注記を参照）。
        console.error("startResizeDragging failed:", err);
      } finally {
        document.body.classList.remove("is-resizing");
      }
    };

  return (
    <div className="resize-handles" aria-hidden="true">
      {HANDLES.map((d) => (
        <div
          key={d}
          className={`resize-handle resize-handle--${slug(d)}`}
          onPointerDown={startResize(d)}
        />
      ))}
    </div>
  );
}
