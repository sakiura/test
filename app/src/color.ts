/** 都道府県ごとに色相をずらして塗り分ける */
export function prefColor(pref: string): { fill: string; stroke: string } {
  let h = 0;
  for (const ch of pref) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { fill: `hsla(${h}, 70%, 50%, 0.55)`, stroke: `hsla(${h}, 70%, 35%, 0.9)` };
}
