// OpenStreetMap (Overpass API) から spots.config.json の各種類の場所を取得し、
// アプリ同梱用の軽量JSON assets/data/spots.json を作る。
//   npm run build:spots                       # 日本全域 (2度四方のタイルに分けて取得。時間がかかる)
//   npm run build:spots -- --bbox 35.5,139.5,35.9,139.9   # 南,西,北,東 の範囲だけ (試作向け)
// データ © OpenStreetMap contributors (ODbL)。アプリ内に表記すること。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ENDPOINT = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const config = JSON.parse(readFileSync(new URL('../spots.config.json', import.meta.url), 'utf8'));
const OUT = new URL('../assets/data/spots.json', import.meta.url);

const argBbox = process.argv.includes('--bbox') ? process.argv[process.argv.indexOf('--bbox') + 1] : null;
const tiles = [];
if (argBbox) {
  tiles.push(argBbox.split(',').map(Number));
} else {
  for (let s = 24; s < 46; s += 2) for (let w = 122; w < 146; w += 2) tiles.push([s, w, s + 2, w + 2]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const M = 111_320;

async function fetchTile(cat, [s, w, n, e]) {
  const body = `[out:json][timeout:120];(${cat.queries.map((q) => `${q}(${s},${w},${n},${e});`).join('')});out tags center bb;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ENDPOINT, { method: 'POST', body: new URLSearchParams({ data: body }) });
    if (res.ok) return (await res.json()).elements ?? [];
    await sleep(5000 * (attempt + 1)); // 429/504 は待って再試行
  }
  throw new Error(`Overpass failed: ${cat.id} ${s},${w}`);
}

const spots = new Map();
for (const cat of config.categories) {
  for (const tile of tiles) {
    for (const el of await fetchTile(cat, tile)) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const name = el.tags?.['name:ja'] ?? el.tags?.name;
      if (lat == null || lon == null || !name) continue;
      // 範囲 (bounds) があれば、その半対角を判定半径に使う。広い公園でも中に入れば訪問扱い。
      let r = cat.radius;
      if (el.bounds) {
        const dy = (el.bounds.maxlat - el.bounds.minlat) * M;
        const dx = (el.bounds.maxlon - el.bounds.minlon) * M * Math.cos((lat * Math.PI) / 180);
        r = Math.min(800, Math.max(r, Math.round(Math.hypot(dx, dy) / 2)));
      }
      spots.set(`${el.type[0]}${el.id}`, { id: `${el.type[0]}${el.id}`, c: cat.id, n: name, la: r5(lat), lo: r5(lon), r });
    }
    await sleep(1500); // 公開サーバーへの配慮
  }
  console.log(`${cat.id}: ${[...spots.values()].filter((s) => s.c === cat.id).length}`);
}

mkdirSync(new URL('./', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify([...spots.values()]));
console.log(`${spots.size} spots written`);
