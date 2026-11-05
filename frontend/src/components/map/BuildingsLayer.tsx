import { useEffect } from "react";
import { useMap } from "./map-context";
import {
  BUILDING_SOURCE_LAYER,
  BUILDINGS_EXTRUSION_LAYER_ID,
  MAP_TILES_SOURCE_ID,
} from "@/lib/map/layers";

const OLD_LAYERS = [
  "coolroute-buildings-obstructing",
  "coolroute-buildings-shade",
  "coolroute-buildings-distant",
  "coolroute-buildings-distant-outline",
];

export function BuildingsLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (!map.getSource(MAP_TILES_SOURCE_ID)) {
      console.warn("[buildings] OpenMapTiles source is unavailable.");
      return;
    }

    for (const id of [...OLD_LAYERS, BUILDINGS_EXTRUSION_LAYER_ID]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    map.addLayer(
      {
        id: BUILDINGS_EXTRUSION_LAYER_ID,
        type: "fill-extrusion",
        source: MAP_TILES_SOURCE_ID,
        "source-layer": BUILDING_SOURCE_LAYER,
        minzoom: 14,

        filter: ["!=", ["get", "hide_3d"], true],

        paint: {
          "fill-extrusion-color": "#C2CEC3",

          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15,
            ["coalesce", ["get", "render_height"], 6],
          ],

          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15,
            ["coalesce", ["get", "render_min_height"], 0],
          ],

          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Base OSM extrusion layer added.");

    return () => {
      if (map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)) {
        map.removeLayer(BUILDINGS_EXTRUSION_LAYER_ID);
      }
    };
  }, [map]);

  return null;
}
