#!/usr/bin/env bun
/**
 * locale の整合チェック（`bun run check:locales`）。
 *
 * 🚨 **i18n の壊れ方は静かだ。** 片方の locale にだけキーを足すと、欠けた方は
 * `fallbackLng` で英語に落ちるだけで**エラーも警告も出ない** —— 日本語 UI に英語が 1 行
 * 混ざるが、それは「まだ訳していない」のか「キーを間違えた」のか画面からは区別できない。
 *
 * ⚠️ **`<Trans>` のスロットはキー名以上に静かに壊れる。** 削除タブの一文は
 * `<pos>` / `<count>` / `<t1>` / `<t2>` を locale 側の並びで組み立てているので、
 * 片方の言語でタグを落とすと**その部品が画面から消える**（数値スピナーごと消えても
 * 文としては読めてしまう）。タグ集合が言語間で一致することまで見る。
 */
import ja from "../src/i18n/locales/ja.json";
import en from "../src/i18n/locales/en.json";

type Json = { [k: string]: string | Json };

function flatten(obj: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

/** `<pos></pos>` `<t1>…</t1>` のようなスロット名を拾う（`<0>` 形式の索引も同様に拾う）。 */
function slots(value: string): Set<string> {
  return new Set([...value.matchAll(/<([a-zA-Z0-9_]+)\s*>/g)].map((m) => m[1]));
}

const locales = { ja: flatten(ja as Json), en: flatten(en as Json) };
const problems: string[] = [];

const allKeys = new Set([...locales.ja.keys(), ...locales.en.keys()]);
for (const key of [...allKeys].sort()) {
  const inJa = locales.ja.has(key);
  const inEn = locales.en.has(key);

  if (!inJa || !inEn) {
    problems.push(`  missing in ${inJa ? "en" : "ja"}: ${key}`);
    continue;
  }

  const [sa, sb] = [slots(locales.ja.get(key)!), slots(locales.en.get(key)!)];
  const onlyJa = [...sa].filter((s) => !sb.has(s));
  const onlyEn = [...sb].filter((s) => !sa.has(s));
  if (onlyJa.length || onlyEn.length) {
    problems.push(
      `  <Trans> slot mismatch at ${key}: ` +
        `${onlyJa.length ? `ja only <${onlyJa.join("> <")}> ` : ""}` +
        `${onlyEn.length ? `en only <${onlyEn.join("> <")}>` : ""}`,
    );
  }
}

if (problems.length) {
  console.error(`✗ locales disagree (${problems.length}):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`✓ locales agree — ${allKeys.size} keys × ${Object.keys(locales).length} languages`);
