export type LonLat = [number, number];
export type RouteKind = "fastest" | "weighted";

export interface RouteSegmentHeat {
  startDist: number;
  endDist: number;
  score: number;
}

export interface RouteSummary {
  distanceM: number;
  durationMin: number;

  // Backend-provided environmental statistics.
  avgHeatScore?: number;
  avgShadeFraction?: number;
  avgUtciDegC?: number | null;
  heatSource?: string;
  heatSourceLabel?: string;
}

export interface RouteOption {
  id: string;
  kind: RouteKind;
  geometry: LonLat[];
  segments: RouteSegmentHeat[];
  summary: RouteSummary;
}
