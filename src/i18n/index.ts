import ja from './ja.json';
import en from './en.json';

export type Lang = 'ja' | 'en';
type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { ja: ja as Dict, en: en as Dict };
let current: Lang = 'en';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

/** Normalise a BCP-47 / SDK language string to a supported language. */
export function normaliseLang(code: string | null | undefined): Lang {
  return (code ?? '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? dicts.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
