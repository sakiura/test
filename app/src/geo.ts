import raw from '../assets/data/municipalities.json';

/** [lng, lat] */
type Ring = [number, number][];
/** 外周 + 穴 */
type Polygon = Ring[];

export type Municipality = {
  /** 全国地方公共団体コード (5桁) */
  c: string;
  /** 都道府県名 */
  p: string;
  /** 市区町村名 */
  n: string;
  /** [minLng, minLat, maxLng, maxLat] */
  b: [number, number, number, number];
  g: Polygon[];
};

export const municipalities = raw as Municipality[];
export const byCode = new Map(municipalities.map((m) => [m.c, m]));

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, poly: Polygon): boolean {
  if (!inRing(lng, lat, poly[0])) return false;
  for (let i = 1; i < poly.length; i++) if (inRing(lng, lat, poly[i])) return false;
  return true;
}

/** 座標が属する市区町村を返す。海上・国外などは null。 */
export function findMunicipality(lng: number, lat: number): Municipality | null {
  for (const m of municipalities) {
    const [x0, y0, x1, y1] = m.b;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    for (const poly of m.g) if (inPolygon(lng, lat, poly)) return m;
  }
  return null;
}
