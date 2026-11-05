import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";
import type { RouteKind } from "@/types/routes";
import {
  BUILDING_SOURCE_LAYER,
  BUILDINGS_EXTRUSION_LAYER_ID,
  MAP_TILES_SOURCE_ID,
} from "@/lib/map/layers";
import {
  createBuildingVisibilityFilter,
  HIDDEN_BUILDING_FILTER,
} from "@/lib/map/buildingVisibility";

const LAYERS = {
  obstructing: "coolroute-buildings-obstructing",
  shade: "coolroute-buildings-shade",
  distant: "coolroute-buildings-distant",
  outline: "coolroute-buildings-distant-outline",
};

const ALL_LAYERS = [
  LAYERS.outline,
  LAYERS.obstructing,
  LAYERS.shade,
  LAYERS.distant,
  BUILDINGS_EXTRUSION_LAYER_ID,
];

interface Props {
  selectedRouteKind: RouteKind;
}

export function BuildingsLayer({ selectedRouteKind }: Props) {
  const map = useMap();
  const { data } = useRoutes();

  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;

  useEffect(() => {
    if (!map) return;

    if (!map.getSource(MAP_TILES_SOURCE_ID)) {
      console.warn(
        `[buildings] Source "${MAP_TILES_SOURCE_ID}" is missing from the loaded style.`,
      );
      return;
    }

    // Remove the previous single-layer implementation if present.
    for (const id of ALL_LAYERS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    const firstSymbolLayer = map
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

    function addExtrusion(id: string, color: string, opacity: number) {
      map.addLayer(
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
        },
        firstSymbolLayer,
      );
    }

    // Buildings directly beside the selected route.
    addExtrusion(LAYERS.obstructing, "#C8D5C9", 0.22);

    // Nearby buildings remain solid and retain their shade-provider appearance.
    addExtrusion(LAYERS.shade, "#C2CEC3", 0.96);

    // Distant buildings use the dark, locked-game-world treatment.
    addExtrusion(LAYERS.distant, "#252E29", 1);

    // Subtle outlines make distant silhouettes readable.
    map.addLayer(
      {
        id: LAYERS.outline,
        type: "line",
        source: MAP_TILES_SOURCE_ID,
        "source-layer": BUILDING_SOURCE_LAYER,
        minzoom: 15,
        filter: HIDDEN_BUILDING_FILTER,
        layout: {
          "line-join": "round",
        },
        paint: {
          "line-color": "#758078",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0.35,
            18,
            0.65,
            20,
            0.85,
          ],
          "line-opacity": 0.58,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Route-aware OSM building layers added.");

    return () => {
      for (const id of ALL_LAYERS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
    };
  }, [map]);

  // Reclassify buildings whenever the selected route changes.
  useEffect(() => {
    if (!map || !selectedRoute) return;

    const baseFilter = [
      "!=",
      ["get", "hide_3d"],
      true,
    ] as maplibregl.FilterSpecification;

    for (const band of ["obstructing", "shade", "distant"] as const) {
      map.setFilter(
        band === "obstructing"
          ? LAYERS.obstructing
          : band === "shade"
            ? LAYERS.shade
            : LAYERS.distant,
        createBuildingVisibilityFilter(
          selectedRoute.geometry,
          band,
          baseFilter,
        ),
      );
    }

    map.setFilter(
      LAYERS.outline,
      createBuildingVisibilityFilter(
        selectedRoute.geometry,
        "distant",
        baseFilter,
      ),
    );
  }, [map, selectedRoute]);

  return null;
}
