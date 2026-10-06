// Writes news/<COUNTRY>.<lang>.json (lang = en, ja) with one calm headline per country and display language,
// plus news/<COUNTRY>.json (local-language edition, for SDK 0.1.26 and earlier). Run by GitHub Actions.
// Source (trial): Google News "Top stories" RSS. Not licensed for commercial use: replace before production.
import { writeFileSync, mkdirSync } from 'node:fs';

// country -> [hl, ceid]. Countries without a Google News edition (e.g. KH) get an English international headline.
const EDITIONS = { US: ['en-US', 'US:en'], JP: ['ja', 'JP:ja'], GB: ['en-GB', 'GB:en'], CA: ['en-CA', 'CA:en'], AU: ['en-AU', 'AU:en'], IN: ['en-IN', 'IN:en'], SG: ['en-SG', 'SG:en'], TH: ['th', 'TH:th'], VN: ['vi', 'VN:vi'] };
const FALLBACK = { KH: 'US' };
// Headlines about violence, disasters, deaths or the military are skipped: they can raise heart rate during the check.
const DARK = new RegExp([
  String.raw`\b(kill|dead|death|die[sd]?\b|dying|shoot|shot\b|gun|murder|war\b|wars\b|attack|bomb|terror|crash|stab|rape|abuse|suicide|hostage|massacre|missile|airstrike|troop|military|army|explosi|protest|riot|unrest|clash|violat|impunity|earthquake|flood|hurricane|wildfire|fire[sd]?\b|violen|hijack|missing|disappear|injur|charged|accus|arrest|police|tragedy|victim)`,
  '内戦|暴力|紛争|侵攻|テロ|抗議|暴動|死亡|死去|殺|事件|事故|戦争|攻撃|爆発|爆撃|空爆|ミサイル|軍事|米軍|銃|地震|津波|台風|豪雨|被害|容疑|逮捕|自殺|遺体|重傷|不明|火災',
  'น้ำท่วม|ตาย|เสียชีวิต|ยิง|ระเบิด|อุบัติเหตุ|ไฟไหม้', 'chết|tử vong|bắn|tai nạn|lũ|cháy|vi phạm', // Thai / Vietnamese basics
].join('|'), 'i');
const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// Same-language edition: the country's own top stories. Other language: news about the country in that language.
const NAME = { US: ['United States', 'アメリカ'], JP: ['Japan', '日本'], GB: ['United Kingdom', 'イギリス'], CA: ['Canada', 'カナダ'], AU: ['Australia', 'オーストラリア'],
  IN: ['India', 'インド'], SG: ['Singapore', 'シンガポール'], TH: ['Thailand', 'タイ'], VN: ['Vietnam', 'ベトナム'], KH: ['Cambodia', 'カンボジア'] };
const LANGS = { en: ['en-US', 'US', 'US:en'], ja: ['ja', 'JP', 'JP:ja'] };
const NATIVE = { US: 'en', GB: 'en', CA: 'en', AU: 'en', IN: 'en', SG: 'en', JP: 'ja' };

async function fetchItems(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({ t: decode(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), d: m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] }));
}
function pick(items, maxAgeH = 36) {
  const now = Date.now();
  const p = items.find((x) => x.t && !DARK.test(x.t) && (!x.d || now - Date.parse(x.d) < maxAgeH * 3600e3));
  if (!p) return null;
  const i = p.t.lastIndexOf(' - ');
  return { title: i > 0 ? p.t.slice(0, i) : p.t, source: i > 0 ? p.t.slice(i + 3) : null, published: p.d ? new Date(p.d).toISOString() : null };
}
const edition = (cc, hl, ceid) => `https://news.google.com/rss?hl=${hl}&gl=${cc}&ceid=${ceid}`;
const search = (q, [hl, gl, ceid]) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&hl=${hl}&gl=${gl}&ceid=${ceid}`;
async function headline(cc, lang) {
  if (NATIVE[cc] === lang) return pick(await fetchItems(edition(cc, ...EDITIONS[cc])));
  return pick(await fetchItems(search(NAME[cc][lang === 'ja' ? 1 : 0], LANGS[lang])));
}
const write = (f, o) => writeFileSync(`news/${f}.json`, JSON.stringify(o, null, 1) + '\n');

mkdirSync('news', { recursive: true });
const updated = new Date().toISOString(), out = {}, files = [];
// 1) local-language editions (legacy files, unchanged)
for (const cc of Object.keys(EDITIONS)) {
  try { const items = await fetchItems(edition(cc, ...EDITIONS[cc])); const h = pick(items, 1e6); if (h) { out[cc] = h; write(cc, { country: cc, ...h, updated_at: updated }); } }
  catch (e) { console.error(e.message); }
}
for (const [cc, from] of Object.entries(FALLBACK)) if (out[from]) write(cc, { country: cc, edition: from, ...out[from], updated_at: updated });
// 2) per display language
for (const cc of Object.keys(NAME)) for (const lang of Object.keys(LANGS)) {
  try { const h = await headline(cc, lang); if (h) { write(`${cc}.${lang}`, { country: cc, lang, ...h, updated_at: updated }); files.push(`${cc}.${lang}`); } }
  catch (e) { console.error(cc, lang, e.message); }
}
write('index', { updated_at: updated, countries: [...Object.keys(out), ...Object.keys(FALLBACK)], files });
console.log(files.length, 'language files');
