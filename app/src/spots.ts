import config from '../spots.config.json';
import raw from '../assets/data/spots.json';
import { M_PER_DEG, type LatLng } from './grid';

export type SpotCategory = { id: string; label: string; emoji: string; radius: number };
export type Spot = { id: string; c: string; n: string; la: number; lo: number; r: number };

export const categories: SpotCategory[] = config.categories;
export const categoryOf = (id: string) => categories.find((c) => c.id === id);

export const spots = raw as Spot[];
export const spotById = new Map(spots.map((s) => [s.id, s]));
export const totalByCategory = new Map<string, number>();
for (const s of spots) totalByCategory.set(s.c, (totalByCategory.get(s.c) ?? 0) + 1);

// 0.01度 (約1.1km) ごとのバケットで近傍検索を高速化
const B = 100;
const buckets = new Map<string, Spot[]>();
for (const s of spots) {
  const k = `${Math.floor(s.la * B)},${Math.floor(s.lo * B)}`;
  const list = buckets.get(k);
  if (list) list.push(s);
  else buckets.set(k, [s]);
}

export const distMeters = (a: LatLng, b: { la: number; lo: number }) =>
  Math.hypot((b.lo - a.lng) * M_PER_DEG * Math.cos((a.lat * Math.PI) / 180), (b.la - a.lat) * M_PER_DEG);

function around(p: LatLng, meters: number): Spot[] {
  const n = Math.ceil(meters / 1100) + 1;
  const [by, bx] = [Math.floor(p.lat * B), Math.floor(p.lng * B)];
  const out: Spot[] = [];
  for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) out.push(...(buckets.get(`${by + dy},${bx + dx}`) ?? []));
  return out;
}

/** 現在地が判定範囲 (半径 + 位置誤差の余裕) に入っている場所 */
export function spotsHere(p: LatLng, slackM = 30): Spot[] {
  return around(p, 1000).filter((s) => distMeters(p, s) <= s.r + slackM);
}

export type SpotDetour = { spot: Spot; meters: number; dir: string };
const DIRS = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

/** 近く (maxM以内) の未訪問の場所で最も近いもの */
export function nearestUnvisitedSpot(p: LatLng, visited: (id: string) => boolean, maxM = 3000): SpotDetour | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const s of around(p, maxM)) {
    if (visited(s.id)) continue;
    const d = distMeters(p, s);
    if (d < bestD) [best, bestD] = [s, d];
  }
  if (!best || bestD > maxM) return null;
  const dxm = (best.lo - p.lng) * Math.cos((p.lat * Math.PI) / 180);
  const deg = (Math.atan2(dxm, best.la - p.lat) * 180) / Math.PI;
  return { spot: best, meters: Math.round(bestD / 10) * 10, dir: DIRS[Math.round(((deg + 360) % 360) / 45) % 8] };
}

/** 表示範囲内の場所 (地図のピン用)。多すぎる場合は打ち切る。 */
export function spotsInRegion(r: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, cap = 80): Spot[] {
  const [s, n] = [r.latitude - r.latitudeDelta / 2, r.latitude + r.latitudeDelta / 2];
  const [w, e] = [r.longitude - r.longitudeDelta / 2, r.longitude + r.longitudeDelta / 2];
  const out: Spot[] = [];
  for (let y = Math.floor(s * B); y <= Math.floor(n * B); y++)
    for (let x = Math.floor(w * B); x <= Math.floor(e * B); x++)
      for (const sp of buckets.get(`${y},${x}`) ?? []) {
        if (out.length >= cap) return out;
        out.push(sp);
      }
  return out;
}
