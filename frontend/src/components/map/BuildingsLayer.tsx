import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";

import type { RouteKind } from "@/types/routes";

import {
  BUILDING_OBSTRUCTION_BASE_M,
  BUILDING_OBSTRUCTION_HEIGHT_FACTOR,
  BUILDING_OBSTRUCTION_MAX_M,
  BUILDING_OBSTRUCTION_MIN_M,
  HIDDEN_BUILDING_FILTER,
} from "@/lib/map/buildingVisibility";

import {
  BUILDING_SOURCE_LAYER,
  BUILDINGS_EXTRUSION_LAYER_ID,
  MAP_TILES_SOURCE_ID,
} from "@/lib/map/layers";

const OBSTRUCTING_LAYER_ID = "coolroute-osm-buildings-obstructing";
const DIVIDER_LAYER_ID = "coolroute-osm-building-divider";

const OLD_LAYERS = [
  "coolroute-buildings-obstructing",
  "coolroute-buildings-shade",
  "coolroute-buildings-distant",
  "coolroute-buildings-distant-outline",
];

interface Props {
  selectedRouteKind: RouteKind;
}

function createOsmBuildingFilters(route: [number, number][]) {
  const routeLine = {
    type: "LineString" as const,
    coordinates: route,
  };

  // Estimate how far an extrusion can visually intrude into the
  // road's screen-space corridor, accounting for its height.
  const obstructionReach = [
    "min",
    BUILDING_OBSTRUCTION_MAX_M,
    [
      "max",
      BUILDING_OBSTRUCTION_MIN_M,
      [
        "+",
        BUILDING_OBSTRUCTION_BASE_M,
        [
          "*",
          ["coalesce", ["get", "render_height"], 6],
          BUILDING_OBSTRUCTION_HEIGHT_FACTOR,
        ],
      ],
    ],
  ];

  const distance = ["distance", routeLine];

  const visibleBuilding = ["!=", ["get", "hide_3d"], true];

  return {
    obstructing: [
      "all",
      visibleBuilding,
      ["<=", distance, obstructionReach],
    ] as unknown as maplibregl.FilterSpecification,

    normal: [
      "all",
      visibleBuilding,
      [">", distance, obstructionReach],
    ] as unknown as maplibregl.FilterSpecification,
  };
}

export function BuildingsLayer({ selectedRouteKind }: Props) {
  const map = useMap();
  const { data } = useRoutes();

  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;

  // Create both OSM extrusion layers once.
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
            "fill-extrusion-color": "#C2CEC3",
            "fill-extrusion-height": heightExpression,
            "fill-extrusion-base": baseExpression,
            "fill-extrusion-opacity": opacity,
            "fill-extrusion-vertical-gradient": true,
          },
        } as maplibregl.FillExtrusionLayerSpecification,
        firstSymbolLayer,
      );
    }

    addBuildingLayer(mapInstance, BUILDINGS_EXTRUSION_LAYER_ID, 0.94);
    addBuildingLayer(mapInstance, OBSTRUCTING_LAYER_ID, 0.12);

    // A subtle non-extrusion divider separates OSM and campus
    // extrusion groups, helping transparent surfaces composite
    // independently instead of merging into one extrusion pass.
    mapInstance.addLayer(
      {
        id: DIVIDER_LAYER_ID,
        type: "line",
        source: MAP_TILES_SOURCE_ID,
        "source-layer": BUILDING_SOURCE_LAYER,
        minzoom: 15,
        filter: HIDDEN_BUILDING_FILTER,
        paint: {
          "line-color": "#758078",
          "line-width": 0.3,
          "line-opacity": 0.08,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Route-aware OSM extrusion layers added.");

    return () => {
      for (const id of [
        DIVIDER_LAYER_ID,
        OBSTRUCTING_LAYER_ID,
        BUILDINGS_EXTRUSION_LAYER_ID,
      ]) {
        if (mapInstance.getLayer(id)) {
          mapInstance.removeLayer(id);
        }
      }
    };
  }, [map]);

  // Reclassify OSM buildings when the selected route changes.
  useEffect(() => {
    if (!map || !selectedRoute) return;

    const filters = createOsmBuildingFilters(selectedRoute.geometry);

    map.setFilter(OBSTRUCTING_LAYER_ID, filters.obstructing);

    map.setFilter(BUILDINGS_EXTRUSION_LAYER_ID, filters.normal);

    map.setFilter(DIVIDER_LAYER_ID, filters.obstructing);
  }, [map, selectedRoute]);

  return null;
}
