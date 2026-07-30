import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ja from "./locales/ja.json";
import en from "./locales/en.json";

/**
 * UI 言語。**同梱の ja/en だけ。**
 *
 * ⚠️ Tabula は `~/.config/<app>/locales/*.json` を読んで言語を足せる拡張点を持っているが、
 * あれは **プラグイン（iframe の外）へ翻訳を配るため**の穴で、DDRenamer には対応する概念が無い。
 * 持ち込むと「誰も使わない拡張点」だけが残る（Tabula 自身、その経路が誰からも import されず
 * 撒かれたファイルが読まれずに残っていた時期がある）。
 *
 * 📌 **ログバーの文言はここに来ない。** 実行ログの status は Rust (`lib.rs`) が英語で返す
 * 「機械の値」で、UI クロームとは別のレーン。翻訳対象は UI クロームだけ。
 */
export const LANGUAGES = ["ja", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const LANG_STORAGE_KEY = "ddrenamer-ui-language";

function isLanguage(v: string | null): v is Language {
  return v !== null && (LANGUAGES as readonly string[]).includes(v);
}

/**
 * 言語の表示名は **その言語自身の綴り**（endonym）で出す。
 * ⚠️ 翻訳してはいけない —— 読めない言語に切り替えてしまった人が戻れなくなる。
 * 各 locale の `_lang_name` が自分の名前を持つ（Kit の locale と同じ作法）。
 */
export function languageDisplayName(lang: Language): string {
  return i18n.getFixedT(lang)("_lang_name");
}

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  // 外部 locale を読む経路が無いので、保存値は同梱リストで検証してよい
  // （Tabula が検証しないのは、この時点でまだ読めていない外部言語があり得るから）。
  if (isLanguage(saved)) return saved;
  return navigator.language.split("-")[0] === "ja" ? "ja" : "en";
};

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React が既に XSS を防ぐ
  },
});

// `<html lang>` を合わせる。フォント選択と折り返し規則が言語で変わるので、
// 表示だけ切り替えて lang を放置すると CJK の行分割が英語の規則で行われる。
const applyHtmlLang = (lang: string) => {
  document.documentElement.lang = lang;
};
applyHtmlLang(i18n.language);
i18n.on("languageChanged", applyHtmlLang);

export async function setLanguage(lang: Language): Promise<void> {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
