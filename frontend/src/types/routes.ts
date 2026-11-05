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
}

export interface RouteOption {
  id: string;
  kind: RouteKind;
  geometry: LonLat[];
  segments: RouteSegmentHeat[];
  summary: RouteSummary;
}
