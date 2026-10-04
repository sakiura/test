import { municipalities } from './geo';
import type { Visits } from './visits';

export type PrefStat = { code: string; name: string; total: number; visited: number };

/** 都道府県コード順 (北海道→沖縄) の達成状況 */
export function prefStats(visits: Visits): PrefStat[] {
  const map = new Map<string, PrefStat>();
  for (const m of municipalities) {
    const code = m.c.slice(0, 2);
    const s = map.get(code) ?? { code, name: m.p, total: 0, visited: 0 };
    s.total++;
    if (visits[m.c]) s.visited++;
    map.set(code, s);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export const percent = (visited: number, total: number) => (total ? Math.round((visited / total) * 100) : 0);
