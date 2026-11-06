import { DEMO_TREES } from "@/services/mock/demoTrees";
import type { LonLat } from "@/types/routes";

import {
  dateAtLocalTime,
  getCampusSolarPosition,
  getTreeShadowSegments,
} from "@/lib/map/solarShadows";

let cachedTimeMinutes = -1;

let cachedSegments = getTreeShadowSegments(
  DEMO_TREES,
  getCampusSolarPosition(dateAtLocalTime(12 * 60)),
);

function getCurrentShadowSegments(timeMinutes: number) {
  if (timeMinutes !== cachedTimeMinutes) {
    cachedTimeMinutes = timeMinutes;

    cachedSegments = getTreeShadowSegments(
      DEMO_TREES,
      getCampusSolarPosition(dateAtLocalTime(timeMinutes)),
    );
  }

  return cachedSegments;
}

function distanceToSegmentMeters(
  point: LonLat,
  start: LonLat,
  end: LonLat,
): number {
  const longitudeScale = 111320 * Math.cos((point[1] * Math.PI) / 180);

  const ax = (start[0] - point[0]) * longitudeScale;
  const ay = (start[1] - point[1]) * 110574;

  const bx = (end[0] - point[0]) * longitudeScale;
  const by = (end[1] - point[1]) * 110574;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));

  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * Estimated tree-shadow coverage at a coordinate.
 * Returns a value between 0 (unshaded) and 1 (fully shaded).
 */
export function treeShadeCoverageAt(
  point: LonLat,
  timeMinutes = 12 * 60,
): number {
  let unshaded = 1;

  for (const shadow of getCurrentShadowSegments(timeMinutes)) {
    const distance = distanceToSegmentMeters(point, shadow.start, shadow.end);

    if (distance >= shadow.radiusM) continue;

    const normalized = distance / shadow.radiusM;
    const influence = (1 + Math.cos(Math.PI * normalized)) / 2;

    unshaded *= 1 - influence;
  }

  return 1 - unshaded;
}
