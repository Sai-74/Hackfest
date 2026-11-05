import { useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "./map-context";
import { DEMO_TREES } from "@/services/mock/demoTrees";
import type { BuildingFeatureCollection } from "@/lib/map/buildingVisibility";
import {
  createSolarShadowCollection,
  getCampusSolarPosition,
} from "@/lib/map/solarShadows";

const SOURCE_ID = "coolroute-solar-shadows";
const FILL_LAYER_ID = "coolroute-solar-shadows-fill";
const SOFT_EDGE_LAYER_ID = "coolroute-solar-shadows-soft-edge";

const TREE_LAYER_ID = "coolroute-tree-extrusions";

const OLD_TREE_SHADE_LAYERS = [
  "coolroute-tree-shade-core",
  "coolroute-tree-shade-soft",
  "coolroute-tree-shade-polygons",
];

const OLD_TREE_SHADE_SOURCE = "coolroute-tree-shade";

const EMPTY_DATA = {
  type: "FeatureCollection" as const,
  features: [],
};

export function SolarShadowsLayer() {
  const map = useMap();

  const [buildingData, setBuildingData] =
    useState<BuildingFeatureCollection | null>(null);

  // Load the existing campus building polygons.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBuildings() {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/campus-buildings-optimized.geojson`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Could not load campus building data for shadows.");
        }

        const collection = (await response.json()) as BuildingFeatureCollection;

        setBuildingData(collection);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[solar] Building shadow data failed to load:", error);
        }
      }
    }

    void loadBuildings();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!map) return;

    // Remove the previous fixed-position tree shadows.
    for (const id of OLD_TREE_SHADE_LAYERS) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    }

    if (map.getSource(OLD_TREE_SHADE_SOURCE)) {
      map.removeSource(OLD_TREE_SHADE_SOURCE);
    }

    if (map.getLayer(SOFT_EDGE_LAYER_ID)) {
      map.removeLayer(SOFT_EDGE_LAYER_ID);
    }

    if (map.getLayer(FILL_LAYER_ID)) {
      map.removeLayer(FILL_LAYER_ID);
    }

    if (map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY_DATA,
      maxzoom: 18,
      buffer: 32,
      tolerance: 0.2,
    });

    // Keep ground shadows underneath the 3D tree models.
    const beforeId = map.getLayer(TREE_LAYER_ID)
      ? TREE_LAYER_ID
      : map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

    map.addLayer(
      {
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#17251C",
          "fill-opacity": ["get", "opacity"],
          "fill-antialias": true,
        },
      } as maplibregl.FillLayerSpecification,
      beforeId,
    );

    // Feather the edges instead of leaving hard polygon outlines.
    map.addLayer(
      {
        id: SOFT_EDGE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#17251C",
          "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 18, 4],
          "line-blur": 2.5,
          "line-opacity": ["*", ["get", "opacity"], 0.45],
        },
      } as maplibregl.LineLayerSpecification,
      beforeId,
    );

    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) return;

    const updateShadows = () => {
      const sun = getCampusSolarPosition(new Date("2026-11-06T12:00:00+05:30"));

      const shadows = createSolarShadowCollection(
        buildingData,
        DEMO_TREES,
        sun,
      );

      source.setData(shadows as Parameters<typeof source.setData>[0]);
    };

    // Initial calculation, then refresh once per minute.
    updateShadows();

    const interval = window.setInterval(updateShadows, 60_000);

    // Refresh immediately when returning to the tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateShadows();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    console.info("[solar] Live campus shadows enabled.");

    return () => {
      window.clearInterval(interval);

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      for (const id of [SOFT_EDGE_LAYER_ID, FILL_LAYER_ID]) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }

      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map, buildingData]);

  return null;
}
