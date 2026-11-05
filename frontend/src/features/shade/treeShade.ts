import { DEMO_TREES } from "@/services/mock/demoTrees";
import type { LonLat } from "@/types/routes";

import {
  getCampusSolarPosition,
  getTreeShadowSegments,
} from "@/lib/map/solarShadows";

let cachedMinute = -1;
let cachedSegments = getTreeShadowSegments(
  DEMO_TREES,
  getCampusSolarPosition(new Date()),
);

function getCurrentShadowSegments() {
  const currentMinute = Math.floor(Date.now() / 60_000);

  if (currentMinute !== cachedMinute) {
    cachedMinute = currentMinute;

    cachedSegments = getTreeShadowSegments(
      DEMO_TREES,
      getCampusSolarPosition(new Date()),
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
export function treeShadeCoverageAt(point: LonLat): number {
  let unshaded = 1;

  for (const shadow of getCurrentShadowSegments()) {
    const distance = distanceToSegmentMeters(point, shadow.start, shadow.end);

    if (distance >= shadow.radiusM) continue;

    const normalized = distance / shadow.radiusM;
    const influence = (1 + Math.cos(Math.PI * normalized)) / 2;

    unshaded *= 1 - influence;
  }

  return 1 - unshaded;
}
