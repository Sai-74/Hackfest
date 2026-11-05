import { useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";
import type { RouteKind } from "@/types/routes";

import {
  annotateBuildingsForRoute,
  createBuildingVisibilityFilter,
  HIDDEN_BUILDING_FILTER,
  type BuildingFeatureCollection,
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

  const [buildingData, setBuildingData] =
    useState<BuildingFeatureCollection | null>(null);

  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;

  // Load campus building data once.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBuildings() {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/campus-buildings-optimized.geojson`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Could not load campus building data.");
        }

        const collection = (await response.json()) as BuildingFeatureCollection;

        setBuildingData(collection);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[buildings] Campus data loading failed:", error);
        }
      }
    }

    void loadBuildings();

    return () => controller.abort();
  }, []);

  // Create the map source and layers.
  useEffect(() => {
    const mapInstance = map;

    if (!mapInstance || !buildingData) return;

    for (const id of Object.values(LAYERS)) {
      if (mapInstance.getLayer(id)) {
        mapInstance.removeLayer(id);
      }
    }

    if (mapInstance.getSource(SOURCE_ID)) {
      mapInstance.removeSource(SOURCE_ID);
    }

    mapInstance.addSource(SOURCE_ID, {
      type: "geojson",
      data: buildingData,
      maxzoom: 18,
      buffer: 32,
      tolerance: 0.375,
    } as Parameters<typeof mapInstance.addSource>[1]);

    const firstSymbolLayer = mapInstance
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    const heightExpression = ["to-number", ["get", "height_m"], 4];

    const shadeColorExpression = [
      "interpolate",
      ["linear"],
      heightExpression,
      1,
      "#E8EEE7",
      5,
      "#E4EBE2",
      10,
      "#DFE7DD",
      15,
      "#D9E3D7",
      21,
      "#D2DED0",
    ];

    function addExtrusion(
      targetMap: MapLibreMap,
      id: string,
      color: string | unknown[],
      opacity: number,
    ) {
      targetMap.addLayer(
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

    addExtrusion(mapInstance, LAYERS.obstructing, "#D0DCCF", 0.12);
    addExtrusion(mapInstance, LAYERS.shade, shadeColorExpression, 0.96);
    addExtrusion(
      mapInstance,
      LAYERS.distant,
      [
        "interpolate",
        ["linear"],
        heightExpression,
        1,
        "#303B33",
        8,
        "#242F28",
        17,
        "#19231D",
      ],
      1,
    );

    mapInstance.addLayer(
      {
        id: LAYERS.outline,
        type: "line",
        source: SOURCE_ID,
        minzoom: 17,
        filter: HIDDEN_BUILDING_FILTER,
        paint: {
          "line-color": "#647267",
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
          "line-opacity": 0.68,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Campus route-aware extrusions added.");

    return () => {
      for (const id of Object.values(LAYERS)) {
        if (mapInstance.getLayer(id)) {
          mapInstance.removeLayer(id);
        }
      }

      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };
  }, [map, buildingData]);

  // Reclassify complete building features for the selected route.
  useEffect(() => {
    const mapInstance = map;

    if (!mapInstance || !buildingData || !selectedRoute) return;

    const source = mapInstance.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) return;

    const classifiedData = annotateBuildingsForRoute(
      buildingData,
      selectedRoute.geometry,
    );

    source.setData(classifiedData as Parameters<typeof source.setData>[0]);

    for (const band of ["obstructing", "shade", "distant"] as const) {
      mapInstance.setFilter(LAYERS[band], createBuildingVisibilityFilter(band));
    }

    mapInstance.setFilter(
      LAYERS.outline,
      createBuildingVisibilityFilter("distant"),
    );
  }, [map, buildingData, selectedRoute]);

  return null;
}
