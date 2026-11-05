import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";
import type { RouteKind } from "@/types/routes";
import {
  createBuildingVisibilityFilter,
  HIDDEN_BUILDING_FILTER,
} from "@/lib/map/buildingVisibility";

const SOURCE_ID = "coolroute-campus-building-cells";

const LAYERS = {
  obstructing: "coolroute-campus-building-obstructing",
  shade: "coolroute-campus-building-shade",
  distant: "coolroute-campus-building-distant",
  outline: "coolroute-campus-building-distant-outline",
};

interface Props {
  selectedRouteKind: RouteKind;
}

export function CampusBuildingCellsLayer({ selectedRouteKind }: Props) {
  const map = useMap();
  const { data } = useRoutes();

  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;

  useEffect(() => {
    if (!map) return;

    // Remove the previous diagnostic/extrusion layers if present.
    for (const id of [
      "coolroute-campus-building-extrusions",
      ...Object.values(LAYERS),
    ]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    if (map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/campus-buildings-optimized.geojson`,
      maxzoom: 18,
      buffer: 32,
      tolerance: 0.375,
    });

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    const heightExpression = ["to-number", ["get", "height_m"], 4];

    const shadeColorExpression = [
      "interpolate",
      ["linear"],
      ["to-number", ["get", "height_m"], 4],
      1,
      "#DDE8D6",
      5,
      "#C6D7BE",
      10,
      "#ADC5A6",
      15,
      "#91AA8C",
      21,
      "#718B72",
    ];

    function addExtrusion(
      id: string,
      color: string | unknown[],
      opacity: number,
    ) {
      map.addLayer(
        {
          id,
          type: "fill-extrusion",
          source: SOURCE_ID,
          minzoom: 14,
          filter: HIDDEN_BUILDING_FILTER,
          paint: {
            "fill-extrusion-height": heightExpression,
            "fill-extrusion-base": 0,
            "fill-extrusion-color": color,
            "fill-extrusion-opacity": opacity,
            "fill-extrusion-vertical-gradient": true,
          },
        } as maplibregl.FillExtrusionLayerSpecification,
        firstSymbolLayer,
      );
    }

    addExtrusion(LAYERS.obstructing, "#D0DCCF", 0.22);

    addExtrusion(LAYERS.shade, shadeColorExpression, 0.96);

    addExtrusion(LAYERS.distant, "#252E29", 1);

    map.addLayer(
      {
        id: LAYERS.outline,
        type: "line",
        source: SOURCE_ID,
        minzoom: 17,
        filter: HIDDEN_BUILDING_FILTER,
        paint: {
          "line-color": "#758078",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            17,
            0.35,
            19,
            0.65,
            20,
            0.85,
          ],
          "line-opacity": 0.58,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Route-aware campus building layers added.");

    return () => {
      for (const id of Object.values(LAYERS)) {
        if (map.getLayer(id)) map.removeLayer(id);
      }

      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  // Reclassify campus polygons whenever the selected route changes.
  useEffect(() => {
    if (!map || !selectedRoute) return;

    for (const band of ["obstructing", "shade", "distant"] as const) {
      const layerId =
        band === "obstructing"
          ? LAYERS.obstructing
          : band === "shade"
            ? LAYERS.shade
            : LAYERS.distant;

      map.setFilter(
        layerId,
        createBuildingVisibilityFilter(selectedRoute.geometry, band),
      );
    }

    map.setFilter(
      LAYERS.outline,
      createBuildingVisibilityFilter(selectedRoute.geometry, "distant"),
    );
  }, [map, selectedRoute]);

  return null;
}
