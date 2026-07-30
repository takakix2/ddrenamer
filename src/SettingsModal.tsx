import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import { CustomSelect } from "./ui-kit/components/tsx/CustomSelect";
import { LANGUAGES, type Language, languageDisplayName, setLanguage } from "./i18n/config";
import { THEMES, type Theme } from "./theme";

/**
 * 設定。**別窓ではなく同一窓のモーダル。**
 *
 * 📌 別窓（Tabula 方式）にすると `tauri.conf.json` と `tauri.macos.conf.json` の
 * **`windows` 配列を両方に書く**ことになる —— プラットフォーム別 config は
 * JSON Merge Patch で **配列を丸ごと置換**するため。片方だけ直すと macOS が古い値のまま
 * ビルドが通る（HANDOFF の二重管理の罠）。項目が 2 つのうちは払う価値が無い。
 *
 * ⚠️ 見た目は Kit の `.modal-*`（`_modal.css` を import 済み）。
 * `.settings-section` / `.setting-row` 系は **Kit と同じクラス名で App.css に自前で持つ** ——
 * Kit の `_settings.css` は `var(--layer-1)` を参照するのに、そのトークンは
 * Kit にも他アプリにも**定義が無い**（背景が透明のまま出る）。10.8KB の Lethe Client 固有語彙
 * （`.nas-card` 等）をリネームツールに持ち込む理由も無い。
 */
export default function SettingsModal({
  theme,
  onThemeChange,
  onClose,
}: {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();

  // Escape で閉じる。⚠️ capture で拾う必要はない（モーダル内に Escape を食う要素が無い）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // テーマ名は Lethe / Dark / Light / Cyber という **Kit の固有名**なので翻訳しない。
  const themeOptions = THEMES.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
  const languageOptions = LANGUAGES.map((v) => ({ value: v, label: languageDisplayName(v) }));

  return (
    <div
      className="modal-overlay active"
      onPointerDown={(e) => {
        // 背景を押したときだけ閉じる（モーダル内の pointerdown はバブリングして来る）
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2>{t("settings.title")}</h2>
          <button className="modal-close" onClick={onClose} title={t("settings.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3 className="section-title">{t("settings.appearance")}</h3>

            <div className="setting-row">
              <div className="setting-info">
                <h4>{t("settings.theme")}</h4>
                <p>{t("settings.themeDesc")}</p>
              </div>
              <div className="setting-control">
                <CustomSelect
                  className="select-fixed"
                  value={theme}
                  onChange={(v: string) => onThemeChange(v as Theme)}
                  options={themeOptions}
                />
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>{t("settings.language")}</h4>
                <p>{t("settings.languageDesc")}</p>
              </div>
              <div className="setting-control">
                <CustomSelect
                  className="select-fixed"
                  value={i18n.language}
                  onChange={(v: string) => setLanguage(v as Language)}
                  options={languageOptions}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
