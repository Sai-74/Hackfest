import { DEMO_TREES } from "@/services/mock/demoTrees";
import type { LonLat } from "@/types/routes";

function distanceMeters(a: LonLat, b: LonLat): number {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;

  const dx = (b[0] - a[0]) * 111320 * Math.cos(latitude);
  const dy = (b[1] - a[1]) * 110574;

  return Math.hypot(dx, dy);
}

/**
 * Estimated tree-shade coverage at a coordinate.
 * Returns a value between 0 (unshaded) and 1 (fully shaded).
 */
export function treeShadeCoverageAt(point: LonLat): number {
  let unshaded = 1;

  for (const tree of DEMO_TREES) {
    const distance = distanceMeters(point, tree.shadeCenter);

    if (distance >= tree.shadeRadiusM) continue;

    const normalized = distance / tree.shadeRadiusM;
    const influence = (1 + Math.cos(Math.PI * normalized)) / 2;

    unshaded *= 1 - influence;
  }

  return 1 - unshaded;
}
