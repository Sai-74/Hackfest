import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";

import type { LonLat, RouteKind } from "@/types/routes";

import {
  BUILDING_OBSTRUCTION_MAX_M,
  BUILDING_SHADE_DISTANCE_M,
  HIDDEN_BUILDING_FILTER,
} from "@/lib/map/buildingVisibility";

import {
  BUILDING_SOURCE_LAYER,
  BUILDINGS_EXTRUSION_LAYER_ID,
  MAP_TILES_SOURCE_ID,
} from "@/lib/map/layers";

const OBSTRUCTING_LAYER_ID = "coolroute-osm-buildings-obstructing";
const DISTANT_LAYER_ID = "coolroute-osm-buildings-distant";
const DIVIDER_LAYER_ID = "coolroute-osm-building-divider";

const OLD_LAYERS = [
  "coolroute-buildings-obstructing",
  "coolroute-buildings-shade",
  "coolroute-buildings-distant",
  "coolroute-buildings-distant-outline",
];

interface CorridorPolygonFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "Polygon";
    coordinates: LonLat[][];
  };
}

interface CorridorFeatureCollection {
  type: "FeatureCollection";
  features: CorridorPolygonFeature[];
}

interface Props {
  selectedRouteKind: RouteKind;
}

function createCameraOcclusionCorridor(
  route: LonLat[],
  bearing: number,
  pitch: number,
): CorridorFeatureCollection {
  const pitchRadians = (Math.max(0, Math.min(85, pitch)) * Math.PI) / 180;

  const depth = Math.min(
    BUILDING_OBSTRUCTION_MAX_M,
    (BUILDING_OBSTRUCTION_MAX_M * Math.tan(pitchRadians)) /
      Math.tan((58 * Math.PI) / 180),
  );

  const features: CorridorPolygonFeature[] = [];

  if (route.length < 2 || depth < 0.25) {
    return { type: "FeatureCollection", features };
  }

  const cameraAzimuth = ((bearing + 180) * Math.PI) / 180;

  const cameraEast = Math.sin(cameraAzimuth);
  const cameraNorth = Math.cos(cameraAzimuth);

  const sideEast = -cameraNorth;
  const sideNorth = cameraEast;

  const halfWidthM = Math.min(18, Math.max(6, depth * 0.5));

  function toCoordinate(origin: LonLat, eastM: number, northM: number): LonLat {
    const latitudeFactor = Math.cos((origin[1] * Math.PI) / 180);

    return [
      origin[0] + eastM / (111320 * latitudeFactor),
      origin[1] + northM / 110574,
    ];
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];

    const longitudeScale = 111320 * Math.cos((a[1] * Math.PI) / 180);

    const bx = (b[0] - a[0]) * longitudeScale;
    const by = (b[1] - a[1]) * 110574;

    if (Math.hypot(bx, by) < 0.1) continue;

    const corners: LonLat[] = [
      toCoordinate(a, -sideEast * halfWidthM, -sideNorth * halfWidthM),

      toCoordinate(a, bx - sideEast * halfWidthM, by - sideNorth * halfWidthM),

      toCoordinate(
        a,
        bx + cameraEast * depth + sideEast * halfWidthM,
        by + cameraNorth * depth + sideNorth * halfWidthM,
      ),

      toCoordinate(
        a,
        cameraEast * depth + sideEast * halfWidthM,
        cameraNorth * depth + sideNorth * halfWidthM,
      ),
    ];

    corners.push(corners[0]);

    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [corners],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function createOsmBuildingFilters(
  route: LonLat[],
  bearing: number,
  pitch: number,
) {
  const visibleBuilding = ["!=", ["get", "hide_3d"], true];

  const pitchRadians = (Math.max(0, Math.min(85, pitch)) * Math.PI) / 180;

  const heightReach = [
    "min",
    BUILDING_OBSTRUCTION_MAX_M,
    ["*", ["coalesce", ["get", "render_height"], 6], Math.tan(pitchRadians)],
  ];

  const obstructionCorridor = createCameraOcclusionCorridor(
    route,
    bearing,
    pitch,
  );

  const routeLine = {
    type: "LineString" as const,
    coordinates: route,
  };

  const hitsCameraCorridor = ["<=", ["distance", obstructionCorridor], 0.1];

  const closeEnoughToRoute = ["<=", ["distance", routeLine], heightReach];

  const isObstructing = ["all", closeEnoughToRoute, hitsCameraCorridor];

  const alwaysFalse = ["==", 1, 0];

  const effectiveObstruction = pitch < 1 ? alwaysFalse : isObstructing;

  const nearby = [
    "all",
    visibleBuilding,
    ["<=", ["distance", routeLine], BUILDING_SHADE_DISTANCE_M],
    ["!", effectiveObstruction],
  ];

  const distant = [
    "all",
    visibleBuilding,
    [">", ["distance", routeLine], BUILDING_SHADE_DISTANCE_M],
  ];

  return {
    obstructing: [
      "all",
      visibleBuilding,
      effectiveObstruction,
    ] as unknown as maplibregl.FilterSpecification,

    nearby: nearby as unknown as maplibregl.FilterSpecification,

    distant: distant as unknown as maplibregl.FilterSpecification,
  };
}

export function BuildingsLayer({ selectedRouteKind }: Props) {
  const map = useMap();
  const { data } = useRoutes();

  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;

  // Create the OSM extrusion layers once.
  useEffect(() => {
    const mapInstance = map;

    if (!mapInstance) return;

    if (!mapInstance.getSource(MAP_TILES_SOURCE_ID)) {
      console.warn("[buildings] OpenMapTiles source is unavailable.");
      return;
    }

    for (const id of [
      ...OLD_LAYERS,
      BUILDINGS_EXTRUSION_LAYER_ID,
      OBSTRUCTING_LAYER_ID,
      DISTANT_LAYER_ID,
      DIVIDER_LAYER_ID,
    ]) {
      if (mapInstance.getLayer(id)) {
        mapInstance.removeLayer(id);
      }
    }

    const firstSymbolLayer = mapInstance
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    const heightExpression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      0,
      15,
      ["coalesce", ["get", "render_height"], 6],
    ];

    const baseExpression = [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      0,
      15,
      ["coalesce", ["get", "render_min_height"], 0],
    ];

    function addBuildingLayer(
      targetMap: MapLibreMap,
      id: string,
      color: string,
      opacity: number,
    ) {
      targetMap.addLayer(
        {
          id,
          type: "fill-extrusion",
          source: MAP_TILES_SOURCE_ID,
          "source-layer": BUILDING_SOURCE_LAYER,
          minzoom: 14,
          filter: HIDDEN_BUILDING_FILTER,
          paint: {
            "fill-extrusion-color": color,
            "fill-extrusion-height": heightExpression,
            "fill-extrusion-base": baseExpression,
            "fill-extrusion-opacity": opacity,
            "fill-extrusion-vertical-gradient": true,
          },
        } as maplibregl.FillExtrusionLayerSpecification,
        firstSymbolLayer,
      );
    }

    // Buildings close to the selected route.
    addBuildingLayer(
      mapInstance,
      BUILDINGS_EXTRUSION_LAYER_ID,
      "#E5EDE5",
      0.96,
    );

    // Buildings farther away: muted green, less visually dominant.
    addBuildingLayer(mapInstance, DISTANT_LAYER_ID, "#59675D", 0.88);

    // Camera-facing buildings that visually obstruct the route.
    addBuildingLayer(mapInstance, OBSTRUCTING_LAYER_ID, "#E5EDE5", 0.14);

    mapInstance.addLayer(
      {
        id: DIVIDER_LAYER_ID,
        type: "line",
        source: MAP_TILES_SOURCE_ID,
        "source-layer": BUILDING_SOURCE_LAYER,
        minzoom: 15,
        filter: HIDDEN_BUILDING_FILTER,
        paint: {
          "line-color": "#65736A",
          "line-width": 0.45,
          "line-opacity": 0.32,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Refined camera-aware building layers added.");

    return () => {
      for (const id of [
        DIVIDER_LAYER_ID,
        OBSTRUCTING_LAYER_ID,
        DISTANT_LAYER_ID,
        BUILDINGS_EXTRUSION_LAYER_ID,
      ]) {
        if (mapInstance.getLayer(id)) {
          mapInstance.removeLayer(id);
        }
      }
    };
  }, [map]);

  // Recalculate building visibility after route or camera changes.
  useEffect(() => {
    if (!map || !selectedRoute) return;

    let lastCameraKey = "";

    const updateOcclusion = () => {
      const bearing = map.getBearing();
      const pitch = map.getPitch();

      const cameraKey = `${bearing.toFixed(2)}:${pitch.toFixed(2)}`;

      if (cameraKey === lastCameraKey) return;

      lastCameraKey = cameraKey;

      const filters = createOsmBuildingFilters(
        selectedRoute.geometry,
        bearing,
        pitch,
      );

      map.setFilter(OBSTRUCTING_LAYER_ID, filters.obstructing);
      map.setFilter(BUILDINGS_EXTRUSION_LAYER_ID, filters.nearby);
      map.setFilter(DISTANT_LAYER_ID, filters.distant);
      map.setFilter(DIVIDER_LAYER_ID, filters.distant);
    };

    updateOcclusion();

    map.on("moveend", updateOcclusion);

    return () => {
      map.off("moveend", updateOcclusion);
    };
  }, [map, selectedRoute]);

  return null;
}
