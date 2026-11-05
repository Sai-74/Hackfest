import type { LonLat } from "@/types/routes";
import type { DemoTree } from "@/services/mock/demoTrees";
import type { BuildingFeatureCollection } from "@/lib/map/buildingVisibility";

export interface SolarPosition {
  azimuthDeg: number;
  elevationDeg: number;
}

export function dateAtLocalTime(
  timeMinutes: number,
  referenceDate = new Date(),
): Date {
  const date = new Date(referenceDate);

  date.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);

  return date;
}

interface SolarShadowFeature {
  type: "Feature";
  id: string;
  properties: {
    kind: "tree" | "building";
    opacity: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: LonLat[][];
  };
}

export interface SolarShadowCollection {
  type: "FeatureCollection";
  features: SolarShadowFeature[];
}

type XY = [number, number];

const CAMPUS_LATITUDE = 20.462886;
const CAMPUS_LONGITUDE = 85.895947;
const MAX_SHADOW_LENGTH_M = 60;

export function getCampusSolarPosition(date: Date): SolarPosition | null {
  const year = date.getUTCFullYear();
  const dayOfYear = Math.floor(
    (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(year, 0, 0)) /
      86_400_000,
  );

  const daysInYear =
    new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;

  const utcHour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;

  const gamma =
    ((2 * Math.PI) / daysInYear) * (dayOfYear - 1 + (utcHour - 12) / 24);

  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const utcMinutes = utcHour * 60;
  const trueSolarMinutes =
    (((utcMinutes + equationOfTime + 4 * CAMPUS_LONGITUDE) % 1440) + 1440) %
    1440;

  const hourAngle = ((trueSolarMinutes / 4 - 180) * Math.PI) / 180;

  const latitude = (CAMPUS_LATITUDE * Math.PI) / 180;

  const sinElevation =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);

  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));

  const elevationDeg = (elevation * 180) / Math.PI;

  // Do not draw direct-sun shadows when the sun is below the horizon.
  if (elevationDeg <= 2.5) return null;

  const azimuth =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitude) -
        Math.tan(declination) * Math.cos(latitude),
    ) + Math.PI;

  return {
    azimuthDeg: ((azimuth * 180) / Math.PI + 360) % 360,
    elevationDeg,
  };
}

function getShadowDisplacement(
  heightM: number,
  sun: SolarPosition,
): { eastM: number; northM: number } {
  const elevation = (sun.elevationDeg * Math.PI) / 180;
  const lengthM = Math.min(MAX_SHADOW_LENGTH_M, heightM / Math.tan(elevation));

  // Shadows extend in the direction opposite to the sun.
  const shadowAzimuth = ((sun.azimuthDeg + 180) * Math.PI) / 180;

  return {
    eastM: Math.sin(shadowAzimuth) * lengthM,
    northM: Math.cos(shadowAzimuth) * lengthM,
  };
}

export interface TreeShadowSegment {
  start: LonLat;
  end: LonLat;
  radiusM: number;
}

export function getTreeShadowSegments(
  trees: DemoTree[],
  sun: SolarPosition | null,
): TreeShadowSegment[] {
  if (!sun) return [];

  return trees.map((tree) => {
    const displacement = getShadowDisplacement(tree.heightM, sun);

    return {
      start: tree.position,
      end: offsetCoordinate(
        tree.position,
        displacement.eastM,
        displacement.northM,
      ),
      radiusM: tree.canopyRadiusM * 0.65,
    };
  });
}

function offsetCoordinate(
  origin: LonLat,
  eastM: number,
  northM: number,
): LonLat {
  const longitudeScale = 111320 * Math.cos((origin[1] * Math.PI) / 180);

  return [origin[0] + eastM / longitudeScale, origin[1] + northM / 110574];
}

function createTreeShadowRing(
  tree: DemoTree,
  displacement: { eastM: number; northM: number },
): LonLat[] {
  const start: XY = [0, 0];
  const end: XY = [displacement.eastM, displacement.northM];
  const radius = tree.canopyRadiusM * 0.65;
  const direction = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const steps = 10;
  const points: XY[] = [];

  // Rounded end of the capsule.
  for (let i = 0; i <= steps; i++) {
    const angle = direction - Math.PI / 2 + (Math.PI * i) / steps;
    points.push([
      end[0] + Math.cos(angle) * radius,
      end[1] + Math.sin(angle) * radius,
    ]);
  }

  // Rounded end at the tree.
  for (let i = 0; i <= steps; i++) {
    const angle = direction + Math.PI / 2 + (Math.PI * i) / steps;
    points.push([
      start[0] + Math.cos(angle) * radius,
      start[1] + Math.sin(angle) * radius,
    ]);
  }

  const ring = points.map(([east, north]) =>
    offsetCoordinate(tree.position, east, north),
  );

  ring.push(ring[0]!);
  return ring;
}

function cross(a: XY, b: XY, c: XY): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function convexHull(points: XY[]): XY[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  if (sorted.length <= 2) return sorted;

  const lower: XY[] = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0
    ) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper: XY[] = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i]!;

    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0
    ) {
      upper.pop();
    }

    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function createBuildingShadowRing(
  ring: LonLat[],
  displacement: { eastM: number; northM: number },
): LonLat[] | null {
  const original = ring.slice(0, -1);
  if (original.length < 3) return null;

  const origin: LonLat = [
    original.reduce((sum, point) => sum + point[0], 0) / original.length,
    original.reduce((sum, point) => sum + point[1], 0) / original.length,
  ];

  const longitudeScale = 111320 * Math.cos((origin[1] * Math.PI) / 180);

  const localPoints: XY[] = original.map((point) => [
    (point[0] - origin[0]) * longitudeScale,
    (point[1] - origin[1]) * 110574,
  ]);

  const translatedPoints: XY[] = localPoints.map(([east, north]) => [
    east + displacement.eastM,
    north + displacement.northM,
  ]);

  const hull = convexHull([...localPoints, ...translatedPoints]);

  if (hull.length < 3) return null;

  const result = hull.map(([east, north]) =>
    offsetCoordinate(origin, east, north),
  );

  result.push(result[0]!);
  return result;
}

export function createSolarShadowCollection(
  buildings: BuildingFeatureCollection | null,
  trees: DemoTree[],
  sun: SolarPosition | null,
): SolarShadowCollection {
  const features: SolarShadowFeature[] = [];

  if (!sun) {
    return { type: "FeatureCollection", features };
  }

  // Tree shadows.
  for (const tree of trees) {
    const displacement = getShadowDisplacement(tree.heightM, sun);

    features.push({
      type: "Feature",
      id: `${tree.id}-solar-shadow`,
      properties: {
        kind: "tree",
        opacity: 0.2,
      },
      geometry: {
        type: "Polygon",
        coordinates: [createTreeShadowRing(tree, displacement)],
      },
    });
  }

  // Campus building shadows.
  if (buildings) {
    buildings.features.forEach((building, buildingIndex) => {
      const rawHeight = Number(building.properties?.height_m);
      const height =
        Number.isFinite(rawHeight) && rawHeight > 0
          ? Math.min(rawHeight, 35)
          : 5;

      const displacement = getShadowDisplacement(height, sun);

      const polygons =
        building.geometry.type === "Polygon"
          ? [building.geometry.coordinates]
          : building.geometry.coordinates;

      polygons.forEach((polygon, polygonIndex) => {
        const outerRing = polygon[0];
        if (!outerRing) return;

        const shadowRing = createBuildingShadowRing(outerRing, displacement);

        if (!shadowRing) return;

        features.push({
          type: "Feature",
          id: `building-shadow-${buildingIndex}-${polygonIndex}`,
          properties: {
            kind: "building",
            opacity: 0.15,
          },
          geometry: {
            type: "Polygon",
            coordinates: [shadowRing],
          },
        });
      });
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
