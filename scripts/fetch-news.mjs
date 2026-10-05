// Writes news/<COUNTRY>.json with one calm top headline per country (run by GitHub Actions).
// Source (trial): Google News "Top stories" RSS. Not licensed for commercial use: replace before production.
import { writeFileSync, mkdirSync } from 'node:fs';

// country -> [hl, ceid]. Countries without a Google News edition (e.g. KH) get an English international headline.
const EDITIONS = { US: ['en-US', 'US:en'], JP: ['ja', 'JP:ja'], GB: ['en-GB', 'GB:en'], CA: ['en-CA', 'CA:en'], AU: ['en-AU', 'AU:en'], IN: ['en-IN', 'IN:en'], SG: ['en-SG', 'SG:en'], TH: ['th', 'TH:th'], VN: ['vi', 'VN:vi'] };
const FALLBACK = { KH: 'US' };
// Headlines about violence, disasters, deaths or the military are skipped: they can raise heart rate during the check.
const DARK = new RegExp([
  String.raw`\b(kill|dead|death|die[sd]?\b|dying|shoot|shot\b|gun|murder|war\b|wars\b|attack|bomb|terror|crash|stab|rape|abuse|suicide|hostage|massacre|missile|airstrike|troop|military|army|explosi|earthquake|flood|hurricane|wildfire|fire[sd]?\b|violen|hijack|missing|disappear|injur|charged|accus|arrest|police|tragedy|victim)`,
  '死亡|死去|殺|事件|事故|戦争|攻撃|爆発|爆撃|空爆|ミサイル|軍事|米軍|銃|地震|津波|台風|豪雨|被害|容疑|逮捕|自殺|遺体|重傷|不明|火災',
  'น้ำท่วม|ตาย|เสียชีวิต|ยิง|ระเบิด|อุบัติเหตุ|ไฟไหม้', 'chết|tử vong|bắn|tai nạn|lũ|cháy|vi phạm', // Thai / Vietnamese basics
].join('|'), 'i');
const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

async function top(cc) {
  const [hl, ceid] = EDITIONS[cc];
  const r = await fetch(`https://news.google.com/rss?hl=${hl}&gl=${cc}&ceid=${ceid}`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${cc}: HTTP ${r.status}`);
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({ t: decode(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''), d: m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] }));
  const pick = items.find((x) => x.t && !DARK.test(x.t));
  if (!pick) return null;
  const i = pick.t.lastIndexOf(' - ');
  return { title: i > 0 ? pick.t.slice(0, i) : pick.t, source: i > 0 ? pick.t.slice(i + 3) : null, published: pick.d ? new Date(pick.d).toISOString() : null };
}

mkdirSync('news', { recursive: true });
const updated = new Date().toISOString(), out = {};
for (const cc of Object.keys(EDITIONS)) {
  try { const h = await top(cc); if (h) { out[cc] = h; writeFileSync(`news/${cc}.json`, JSON.stringify({ country: cc, ...h, updated_at: updated }, null, 1) + '\n'); } }
  catch (e) { console.error(e.message); }
}
for (const [cc, from] of Object.entries(FALLBACK)) if (out[from]) writeFileSync(`news/${cc}.json`, JSON.stringify({ country: cc, edition: from, ...out[from], updated_at: updated }, null, 1) + '\n');
writeFileSync('news/index.json', JSON.stringify({ updated_at: updated, countries: [...Object.keys(out), ...Object.keys(FALLBACK)] }) + '\n');
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.title])));
