import type { FilterSpecification } from "maplibre-gl";
import type { LonLat } from "@/types/routes";

export const BUILDING_OBSTRUCTION_DISTANCE_M = 9;
export const BUILDING_SHADE_DISTANCE_M = 32;

export type BuildingVisibilityBand = "obstructing" | "shade" | "distant";

export const HIDDEN_BUILDING_FILTER = [
  "==",
  1,
  0,
] as unknown as FilterSpecification;

export function createBuildingVisibilityFilter(
  routeGeometry: LonLat[],
  band: BuildingVisibilityBand,
  baseFilter?: FilterSpecification,
): FilterSpecification {
  const routeLine = {
    type: "LineString" as const,
    coordinates: routeGeometry,
  };

  const distance = ["distance", routeLine];

  let bandFilter: unknown;

  switch (band) {
    case "obstructing":
      bandFilter = ["<", distance, BUILDING_OBSTRUCTION_DISTANCE_M];
      break;

    case "shade":
      bandFilter = [
        "all",
        [">=", distance, BUILDING_OBSTRUCTION_DISTANCE_M],
        ["<=", distance, BUILDING_SHADE_DISTANCE_M],
      ];
      break;

    case "distant":
      bandFilter = [">", distance, BUILDING_SHADE_DISTANCE_M];
      break;
  }

  const filter = baseFilter ? ["all", baseFilter, bandFilter] : bandFilter;

  return filter as FilterSpecification;
}
