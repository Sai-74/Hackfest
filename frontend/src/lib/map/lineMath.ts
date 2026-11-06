import type { LonLat } from "@/types/routes";

export interface LineIndex {
  total: number;
  pointAt(dist: number): LonLat;
  bearingAt(dist: number): number;
}

export function buildLineIndex(coords: LonLat[]): LineIndex {
  const lat0 = (coords[0][1] + coords[coords.length - 1][1]) / 2;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110574;
  const xy = coords.map(([lon, lat]) => [lon * kx, lat * ky] as const);
  const cum = [0];
  for (let i = 1; i < xy.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]),
    );
  }
  const total = cum[cum.length - 1];

  const clamp = (d: number) => Math.min(Math.max(d, 0), total);

  function segmentAt(d: number): number {
    const dd = clamp(d);
    let lo = 0;
    let hi = cum.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= dd) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function pointAt(d: number): LonLat {
    const i = segmentAt(d);
    const segLen = cum[i + 1] - cum[i] || 1;
    const t = (clamp(d) - cum[i]) / segLen;
    const x = xy[i][0] + (xy[i + 1][0] - xy[i][0]) * t;
    const y = xy[i][1] + (xy[i + 1][1] - xy[i][1]) * t;
    return [x / kx, y / ky];
  }

  function bearingAt(d: number): number {
    const i = segmentAt(d);
    const dx = xy[i + 1][0] - xy[i][0];
    const dy = xy[i + 1][1] - xy[i][1];
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }

  return { total, pointAt, bearingAt };
}
