// 市区町村境界データ (smartnews-smri/japan-topography, 国土数値情報 N03 を加工したもの) を
// アプリ同梱用の軽量JSONに変換する。 `npm run build:data`
import { writeFileSync, mkdirSync } from 'node:fs';
import { feature } from 'topojson-client';

const SRC =
  'https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0010/N03-21_210101.json';
const OUT = new URL('../assets/data/municipalities.json', import.meta.url);

const topo = await (await fetch(SRC)).json();
const fc = feature(topo, Object.values(topo.objects)[0]);

const r = (n) => Math.round(n * 1e4) / 1e4;
const byCode = new Map();
for (const f of fc.features) {
  const p = f.properties;
  const code = p.N03_007;
  if (!code) continue; // 所属未定地
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rounded = polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [r(x), r(y)])));
  const e = byCode.get(code) ?? {
    c: code,
    p: p.N03_001,
    n: (p.N03_003 ?? '') + (p.N03_004 ?? ''),
    g: [],
  };
  e.g.push(...rounded);
  byCode.set(code, e);
}

const out = [...byCode.values()].map((e) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of e.g)
    for (const [x, y] of poly[0]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return { ...e, b: [x0, y0, x1, y1] };
});

mkdirSync(new URL('./', OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`${out.length} municipalities written`);
