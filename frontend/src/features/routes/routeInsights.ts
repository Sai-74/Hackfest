import type { RouteOption, LonLat } from "@/types/routes";

import { buildLineIndex } from "@/lib/map/lineMath";
import { HEAT_BANDS, heatBandFor } from "@/features/heat/heatScale";
import { treeShadeCoverageAt } from "@/features/shade/treeShade";
import { DEMO_WATER_POINTS } from "@/services/mock/demoWater";

const SHADE_SAMPLE_STEP_M = 4;
const WATER_NEARBY_THRESHOLD_M = 60;

export interface HeatBandBreakdown {
  id: string;
  label: string;
  color: string;
  distanceM: number;
  percent: number;
}

export interface NearbyWaterPoint {
  id: string;
  name: string;
  position: LonLat;
  distanceFromRouteM: number;
  alongRouteM: number;
}

export interface RouteInsightsData {
  averageHeatScore: number;
  averageHeatLabel: string;
  averageHeatColor: string;

  shadedDistanceM: number;
  shadePercent: number;

  heatBreakdown: HeatBandBreakdown[];

  nearbyWaterCount: number;
  nearbyWaterPoints: NearbyWaterPoint[];
}

function nearestPointOnRoute(
  point: LonLat,
  geometry: LonLat[],
): { distanceM: number; alongRouteM: number } {
  const longitudeScale = 111320 * Math.cos((point[1] * Math.PI) / 180);

  let cumulativeDistance = 0;
  let minimumDistance = Infinity;
  let nearestAlongRoute = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];

    // Coordinates relative to the water point, in metres.
    const ax = (a[0] - point[0]) * longitudeScale;
    const ay = (a[1] - point[1]) * 110574;

    const bx = (b[0] - point[0]) * longitudeScale;
    const by = (b[1] - point[1]) * 110574;

    const dx = bx - ax;
    const dy = by - ay;

    const segmentLength = Math.hypot(dx, dy);
    const denominator = dx * dx + dy * dy;

    const t =
      denominator === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));

    const nearestX = ax + t * dx;
    const nearestY = ay + t * dy;

    const distance = Math.hypot(nearestX, nearestY);

    if (distance < minimumDistance) {
      minimumDistance = distance;
      nearestAlongRoute = cumulativeDistance + segmentLength * t;
    }

    cumulativeDistance += segmentLength;
  }

  return {
    distanceM: minimumDistance,
    alongRouteM: nearestAlongRoute,
  };
}

function calculateHeatBreakdown(route: RouteOption): {
  averageHeatScore: number;
  averageHeatLabel: string;
  averageHeatColor: string;
  breakdown: HeatBandBreakdown[];
} {
  const totalLength = route.segments.reduce(
    (sum, segment) => sum + segment.endDist - segment.startDist,
    0,
  );

  const weightedScore = route.segments.reduce(
    (sum, segment) =>
      sum + segment.score * (segment.endDist - segment.startDist),
    0,
  );

  const averageHeatScore =
    totalLength > 0 ? Math.round(weightedScore / totalLength) : 0;

  const averageBand = heatBandFor(averageHeatScore);

  const breakdown = HEAT_BANDS.map((band) => {
    const distanceM = route.segments.reduce((sum, segment) => {
      if (heatBandFor(segment.score).id !== band.id) {
        return sum;
      }

      return sum + segment.endDist - segment.startDist;
    }, 0);

    return {
      id: band.id,
      label: band.label,
      color: band.color,
      distanceM,
      percent: totalLength > 0 ? (distanceM / totalLength) * 100 : 0,
    };
  });

  return {
    averageHeatScore,
    averageHeatLabel: averageBand.label,
    averageHeatColor: averageBand.color,
    breakdown,
  };
}

function calculateShadeCoverage(geometry: LonLat[]): {
  shadedDistanceM: number;
  shadePercent: number;
} {
  if (geometry.length < 2) {
    return { shadedDistanceM: 0, shadePercent: 0 };
  }

  const index = buildLineIndex(geometry);

  if (!Number.isFinite(index.total) || index.total <= 0) {
    return { shadedDistanceM: 0, shadePercent: 0 };
  }

  let shadedDistanceM = 0;

  for (let start = 0; start < index.total; start += SHADE_SAMPLE_STEP_M) {
    const sampleLength = Math.min(SHADE_SAMPLE_STEP_M, index.total - start);

    const midpoint = start + sampleLength / 2;
    const coverage = treeShadeCoverageAt(index.pointAt(midpoint));

    shadedDistanceM += sampleLength * coverage;
  }

  return {
    shadedDistanceM,
    shadePercent: (shadedDistanceM / index.total) * 100,
  };
}

function calculateNearbyWaterPoints(geometry: LonLat[]): {
  nearbyWaterCount: number;
  nearbyWaterPoints: NearbyWaterPoint[];
} {
  if (geometry.length < 2) {
    return {
      nearbyWaterCount: 0,
      nearbyWaterPoints: [],
    };
  }

  const nearby = DEMO_WATER_POINTS.map((point) => {
    const nearest = nearestPointOnRoute(point.position, geometry);

    return {
      ...point,
      distanceFromRouteM: nearest.distanceM,
      alongRouteM: nearest.alongRouteM,
    };
  })
    .filter((point) => point.distanceFromRouteM <= WATER_NEARBY_THRESHOLD_M)
    .sort((a, b) => a.alongRouteM - b.alongRouteM);

  return {
    nearbyWaterCount: nearby.length,
    nearbyWaterPoints: nearby.slice(0, 3).map((point) => ({
      ...point,
      distanceFromRouteM: Math.round(point.distanceFromRouteM),
      alongRouteM: Math.round(point.alongRouteM),
    })),
  };
}

export function calculateRouteInsights(route: RouteOption): RouteInsightsData {
  const heat = calculateHeatBreakdown(route);
  const shade = calculateShadeCoverage(route.geometry);
  const water = calculateNearbyWaterPoints(route.geometry);

  return {
    averageHeatScore: heat.averageHeatScore,
    averageHeatLabel: heat.averageHeatLabel,
    averageHeatColor: heat.averageHeatColor,

    shadedDistanceM: shade.shadedDistanceM,
    shadePercent: shade.shadePercent,

    heatBreakdown: heat.breakdown,

    nearbyWaterCount: water.nearbyWaterCount,
    nearbyWaterPoints: water.nearbyWaterPoints,
  };
}
