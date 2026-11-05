import type { FilterSpecification } from "maplibre-gl";
import type { LonLat } from "@/types/routes";

export const BUILDING_OBSTRUCTION_DISTANCE_M = 7;
export const BUILDING_SHADE_DISTANCE_M = 42;

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

type XY = [number, number];
type Ring = XY[];
type PolygonRings = Ring[];

function projectLocal(
  point: LonLat,
  origin: LonLat,
  longitudeScale: number,
): XY {
  return [
    (point[0] - origin[0]) * longitudeScale,
    (point[1] - origin[1]) * 110574,
  ];
}

function cross(a: XY, b: XY, c: XY): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointToSegmentDistance(point: XY, start: XY, end: XY): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared,
    ),
  );

  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy),
  );
}

function segmentsIntersect(a: XY, b: XY, c: XY, d: XY): boolean {
  const epsilon = 1e-7;

  const o1 = cross(a, b, c);
  const o2 = cross(a, b, d);
  const o3 = cross(c, d, a);
  const o4 = cross(c, d, b);

  if (
    ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon)) &&
    ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))
  ) {
    return true;
  }

  return (
    pointToSegmentDistance(c, a, b) <= epsilon ||
    pointToSegmentDistance(d, a, b) <= epsilon ||
    pointToSegmentDistance(a, c, d) <= epsilon ||
    pointToSegmentDistance(b, c, d) <= epsilon
  );
}

function segmentToSegmentDistance(a: XY, b: XY, c: XY, d: XY): number {
  if (segmentsIntersect(a, b, c, d)) return 0;

  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function pointInRing(point: XY, ring: Ring): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];

    const crosses =
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];

    if (crosses) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: XY, rings: PolygonRings): boolean {
  if (!rings.length || !pointInRing(point, rings[0])) {
    return false;
  }

  // Interior rings represent holes.
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) {
      return false;
    }
  }

  return true;
}

function collectPolygonDistance(rings: PolygonRings, route: XY[]): number {
  if (!rings.length || route.length < 2) {
    return Infinity;
  }

  let minimumDistance = Infinity;

  for (let i = 0; i < route.length - 1; i++) {
    const routeStart = route[i];
    const routeEnd = route[i + 1];

    const midpoint: XY = [
      (routeStart[0] + routeEnd[0]) / 2,
      (routeStart[1] + routeEnd[1]) / 2,
    ];

    // The route is inside the polygon, not just near it.
    if (
      pointInPolygon(routeStart, rings) ||
      pointInPolygon(midpoint, rings) ||
      pointInPolygon(routeEnd, rings)
    ) {
      return 0;
    }

    for (const ring of rings) {
      for (let j = 0; j < ring.length - 1; j++) {
        const distance = segmentToSegmentDistance(
          routeStart,
          routeEnd,
          ring[j],
          ring[j + 1],
        );

        minimumDistance = Math.min(minimumDistance, distance);

        if (minimumDistance === 0) return 0;
      }
    }
  }

  return minimumDistance;
}

export function distanceGeometryToRouteMeters(
  geometry: BuildingGeometry,
  route: LonLat[],
): number {
  if (route.length < 2) return Number.MAX_SAFE_INTEGER;

  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  let minimumDistance = Infinity;

  for (const polygon of polygons) {
    const firstCoordinate = polygon[0]?.[0];

    if (!firstCoordinate) continue;

    const reference = firstCoordinate;
    const latitude = (reference[1] * Math.PI) / 180;
    const longitudeScale = 111320 * Math.cos(latitude);

    const projectedRings = polygon.map((ring) =>
      ring.map((point) => projectLocal(point, reference, longitudeScale)),
    );

    const projectedRoute = route.map((point) =>
      projectLocal(point, reference, longitudeScale),
    );

    const distance = collectPolygonDistance(projectedRings, projectedRoute);

    minimumDistance = Math.min(minimumDistance, distance);

    if (minimumDistance === 0) return 0;
  }

  return minimumDistance;
}

export function annotateBuildingsForRoute(
  collection: BuildingFeatureCollection,
  route: LonLat[],
): BuildingFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        route_distance_m: distanceGeometryToRouteMeters(
          feature.geometry,
          route,
        ),
      },
    })),
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
