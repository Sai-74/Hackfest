import type { FilterSpecification } from "maplibre-gl";
import type { LonLat } from "@/types/routes";

export const BUILDING_OBSTRUCTION_DISTANCE_M = 9;
export const BUILDING_SHADE_DISTANCE_M = 32;

export type BuildingVisibilityBand = "obstructing" | "shade" | "distant";

export interface BuildingPolygon {
  type: "Polygon";
  coordinates: LonLat[][];
}

export interface BuildingMultiPolygon {
  type: "MultiPolygon";
  coordinates: LonLat[][][];
}

export type BuildingGeometry = BuildingPolygon | BuildingMultiPolygon;

export interface BuildingFeature {
  type: "Feature";
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: BuildingGeometry;
}

export interface BuildingFeatureCollection {
  type: "FeatureCollection";
  features: BuildingFeature[];
  [key: string]: unknown;
}

export const HIDDEN_BUILDING_FILTER = [
  "==",
  ["get", "__coolroute_visibility_pending__"],
  true,
] as unknown as FilterSpecification;

function collectPositions(value: unknown, output: LonLat[] = []): LonLat[] {
  if (!Array.isArray(value)) return output;

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    output.push([value[0], value[1]]);
    return output;
  }

  for (const child of value) {
    collectPositions(child, output);
  }

  return output;
}

function geometryCenter(geometry: BuildingGeometry): LonLat {
  const positions = collectPositions(geometry.coordinates);

  if (positions.length === 0) return [0, 0];

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of positions) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

export function distancePointToRouteMeters(
  point: LonLat,
  route: LonLat[],
): number {
  if (route.length < 2) return Number.MAX_SAFE_INTEGER;

  const xScale = 111320 * Math.cos((point[1] * Math.PI) / 180);

  let minimumDistance = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];

    const ax = (a[0] - point[0]) * xScale;
    const ay = (a[1] - point[1]) * 110574;

    const bx = (b[0] - point[0]) * xScale;
    const by = (b[1] - point[1]) * 110574;

    const dx = bx - ax;
    const dy = by - ay;

    const denominator = dx * dx + dy * dy;

    const t =
      denominator === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));

    const nearestX = ax + t * dx;
    const nearestY = ay + t * dy;

    minimumDistance = Math.min(minimumDistance, Math.hypot(nearestX, nearestY));
  }

  return minimumDistance;
}

export function annotateBuildingsForRoute(
  collection: BuildingFeatureCollection,
  route: LonLat[],
): BuildingFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const center = geometryCenter(feature.geometry);

      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          route_distance_m: distancePointToRouteMeters(center, route),
        },
      };
    }),
  };
}

export function createBuildingVisibilityFilter(
  band: BuildingVisibilityBand,
): FilterSpecification {
  switch (band) {
    case "obstructing":
      return ["<", "route_distance_m", BUILDING_OBSTRUCTION_DISTANCE_M];

    case "shade":
      return [
        "all",
        [">=", "route_distance_m", BUILDING_OBSTRUCTION_DISTANCE_M],
        ["<=", "route_distance_m", BUILDING_SHADE_DISTANCE_M],
      ];

    case "distant":
      return [">", "route_distance_m", BUILDING_SHADE_DISTANCE_M];
  }
}
