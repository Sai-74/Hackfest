import { useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "./map-context";
import { DEMO_TREES } from "@/services/mock/demoTrees";
import { useSolarTime } from "@/features/shade/solar-time-context";

import type { BuildingFeatureCollection } from "@/lib/map/buildingVisibility";

import {
  createSolarShadowCollection,
  dateAtLocalTime,
  getCampusSolarPosition,
} from "@/lib/map/solarShadows";

import { BUILDINGS_EXTRUSION_LAYER_ID } from "@/lib/map/layers";

const SOURCE_ID = "coolroute-solar-shadows";
const FILL_LAYER_ID = "coolroute-solar-shadows-fill";
const SOFT_EDGE_LAYER_ID = "coolroute-solar-shadows-soft-edge";

const CAMPUS_CELL_LAYER_ID = "coolroute-campus-cell-extrusions";

const OLD_SHADE_LAYERS = [
  "coolroute-tree-shade-core",
  "coolroute-tree-shade-soft",
  "coolroute-tree-shade-polygons",
];

const OLD_SHADE_SOURCE = "coolroute-tree-shade";

const EMPTY_DATA = {
  type: "FeatureCollection" as const,
  features: [],
};

export function SolarShadowsLayer() {
  const map = useMap();
  const { timeMinutes } = useSolarTime();

  const [buildingData, setBuildingData] =
    useState<BuildingFeatureCollection | null>(null);

  // Load the original campus cells for building shadow generation.
  useEffect(() => {
    const controller = new AbortController();

    async function loadBuildingData() {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/buildings-wgs84.geojson`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Could not load building shadow data.");
        }

        const data = (await response.json()) as BuildingFeatureCollection;

        if (!controller.signal.aborted) {
          setBuildingData(data);
          console.info(
            `[solar] Loaded ${data.features.length} campus cells for building shadows.`,
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn(
            "[solar] Building shadows unavailable; retaining tree shadows.",
            error,
          );
        }
      }
    }

    void loadBuildingData();

    return () => controller.abort();
  }, []);

  // Create the shadow source and layers once.
  useEffect(() => {
    if (!map) return;

    for (const id of OLD_SHADE_LAYERS) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    }

    if (map.getSource(OLD_SHADE_SOURCE)) {
      map.removeSource(OLD_SHADE_SOURCE);
    }

    for (const id of [SOFT_EDGE_LAYER_ID, FILL_LAYER_ID]) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    }

    if (map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY_DATA,
    });

    // Keep shadows below campus cells and actual OSM extrusions.
    const beforeId = map.getLayer(CAMPUS_CELL_LAYER_ID)
      ? CAMPUS_CELL_LAYER_ID
      : map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)
        ? BUILDINGS_EXTRUSION_LAYER_ID
        : map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

    map.addLayer(
      {
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        minzoom: 15,
        paint: {
          "fill-color": "#17251C",
          "fill-opacity": ["get", "opacity"],
          "fill-antialias": true,
        },
      } as maplibregl.FillLayerSpecification,
      beforeId,
    );

    map.addLayer(
      {
        id: SOFT_EDGE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        minzoom: 15,
        paint: {
          "line-color": "#17251C",
          "line-width": ["interpolate", ["linear"], ["zoom"], 15, 1.5, 18, 4],
          "line-blur": 3,
          "line-opacity": ["*", ["get", "opacity"], 0.35],
        },
      } as maplibregl.LineLayerSpecification,
      beforeId,
    );

    console.info("[solar] Tree and campus shadow layers added.");

    return () => {
      for (const id of [SOFT_EDGE_LAYER_ID, FILL_LAYER_ID]) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }

      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  // Recalculate both tree and building shadows whenever time changes.
  useEffect(() => {
    if (!map) return;

    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) return;

    const selectedDate = dateAtLocalTime(timeMinutes);
    const sun = getCampusSolarPosition(selectedDate);

    const shadows = createSolarShadowCollection(buildingData, DEMO_TREES, sun);

    source.setData(shadows as Parameters<typeof source.setData>[0]);
  }, [map, timeMinutes, buildingData]);

  return null;
}
