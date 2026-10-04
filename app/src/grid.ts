// 日常用の細かい区画。緯度経度を固定幅で区切った格子 (日本付近で約270m四方)。
// 境界データが不要で、端末内だけで完結する。
export const DLAT = 0.0025;
export const DLNG = 0.003;
const M_PER_DEG = 111_320;

export type Cell = { iy: number; ix: number };
export type LatLng = { lat: number; lng: number };

export const cellOf = (lat: number, lng: number): Cell => ({
  iy: Math.floor(lat / DLAT),
  ix: Math.floor(lng / DLNG),
});
export const keyOf = (c: Cell) => `${c.iy},${c.ix}`;
export function parseKey(k: string): Cell {
  const [iy, ix] = k.split(',').map(Number);
  return { iy, ix };
}

/** 区画の四隅 (地図描画用) */
export function cellCorners({ iy, ix }: Cell) {
  const [s, n, w, e] = [iy * DLAT, (iy + 1) * DLAT, ix * DLNG, (ix + 1) * DLNG];
  return [
    { latitude: s, longitude: w },
    { latitude: s, longitude: e },
    { latitude: n, longitude: e },
    { latitude: n, longitude: w },
  ];
}

export const cellCenter = ({ iy, ix }: Cell): LatLng => ({ lat: (iy + 0.5) * DLAT, lng: (ix + 0.5) * DLNG });

const distM = (a: LatLng, b: LatLng) => {
  const dy = (b.lat - a.lat) * M_PER_DEG;
  const dx = (b.lng - a.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

/** 前回地点から今回地点までに通った区画 (歩行で区画を飛ばさないよう補間)。遠く離れた場合は今回地点のみ。 */
export function cellsAlong(a: LatLng | null, b: LatLng): Cell[] {
  const end = cellOf(b.lat, b.lng);
  if (!a || distM(a, b) > 3000) return [end];
  const steps = Math.max(1, Math.ceil(distM(a, b) / 100));
  const seen = new Map<string, Cell>();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = cellOf(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
    seen.set(keyOf(c), c);
  }
  return [...seen.values()];
}

const DIRS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

export type Detour = { cell: Cell; meters: number; dir: string; theme: string };

const THEMES = [
  'いつもと違う一本裏道を選んでみよう',
  '知らない角を一つ曲がってみよう',
  '気になっていたお店や公園に寄り道しよう',
  'ゆっくり景色を見ながら歩いてみよう',
  '帰り道だけ遠回りしてみよう',
];

/** 現在地に近い未訪問の区画を探し、寄り道の提案にする。見つからなければ null。 */
export function suggestDetour(here: LatLng, has: (key: string) => boolean, maxRing = 12): Detour | null {
  const c0 = cellOf(here.lat, here.lng);
  for (let r = 1; r <= maxRing; r++) {
    let best: { cell: Cell; d: number } | null = null;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dy), Math.abs(dx)) !== r) continue; // リングの縁だけ
        const cell = { iy: c0.iy + dy, ix: c0.ix + dx };
        if (has(keyOf(cell))) continue;
        const d = distM(here, cellCenter(cell));
        if (!best || d < best.d) best = { cell, d };
      }
    }
    if (best) {
      const t = cellCenter(best.cell);
      const dxm = (t.lng - here.lng) * Math.cos((here.lat * Math.PI) / 180);
      const deg = (Math.atan2(dxm, t.lat - here.lat) * 180) / Math.PI;
      const dir = DIRS[Math.round(((deg + 360) % 360) / 45) % 8];
      const theme = THEMES[Math.abs(best.cell.iy * 31 + best.cell.ix) % THEMES.length];
      return { cell: best.cell, meters: Math.round(best.d / 10) * 10, dir, theme };
    }
  }
  return null;
}

/** 端末のローカル日付 YYYY-MM-DD */
export function todayStr(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 区画1つあたりの面積 (km², 北緯35度付近) */
export const CELL_KM2 = ((DLAT * M_PER_DEG) * (DLNG * M_PER_DEG * Math.cos((35 * Math.PI) / 180))) / 1e6;
