import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "./map-context";
import { DEMO_TREES } from "@/services/mock/demoTrees";
import { useSolarTime } from "@/features/shade/solar-time-context";
import {
  createSolarShadowCollection,
  dateAtLocalTime,
  getCampusSolarPosition,
} from "@/lib/map/solarShadows";
import { BUILDINGS_EXTRUSION_LAYER_ID } from "@/lib/map/layers";

const SOURCE_ID = "coolroute-solar-shadows";
const FILL_LAYER_ID = "coolroute-solar-shadows-fill";
const SOFT_EDGE_LAYER_ID = "coolroute-solar-shadows-soft-edge";

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

  // Create the shadow source and layers once.
  useEffect(() => {
    if (!map) return;

    // Remove the previous fixed-position tree shadows.
    for (const id of OLD_SHADE_LAYERS) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    }

    if (map.getSource(OLD_SHADE_SOURCE)) {
      map.removeSource(OLD_SHADE_SOURCE);
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
    });

    // Put shadows on the ground, underneath building extrusions.
    const beforeId = map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)
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

  // Recalculate shadows whenever the slider changes.
  useEffect(() => {
    if (!map) return;

    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) return;

    const selectedDate = dateAtLocalTime(timeMinutes);
    const sun = getCampusSolarPosition(selectedDate);

    // Only tree shadows for this pass. Building footprints from the
    // optimized campus dataset are not reliable enough for shadow geometry.
    const shadows = createSolarShadowCollection(null, DEMO_TREES, sun);

    source.setData(shadows as Parameters<typeof source.setData>[0]);
  }, [map, timeMinutes]);

  return null;
}
