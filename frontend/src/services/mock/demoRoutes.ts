import { DEMO_DESTINATION, DEMO_ORIGIN } from "@/lib/map/config";
import { buildLineIndex } from "@/lib/map/lineMath";
import type { RouteOption } from "@/types/routes";

export function mockRouteOptions(): RouteOption[] {
  const geometry = [DEMO_ORIGIN, DEMO_DESTINATION];
  const index = buildLineIndex(geometry);
  const segments = [
    { startDist: 0, endDist: index.total * 0.5, score: 28 },
    { startDist: index.total * 0.5, endDist: index.total, score: 72 },
  ];
  const shared = {
    geometry,
    segments,
    summary: {
      distanceM: Math.round(index.total),
      durationMin: Math.max(1, Math.round(index.total / 80)),
    },
  };
  return [
    { ...shared, id: "mock-fastest", kind: "fastest" },
    { ...shared, id: "mock-weighted", kind: "weighted" },
  ];
}
