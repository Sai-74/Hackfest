import { useEffect } from "react";
import { useMap } from "./map-context";
import {
  BUILDING_SOURCE_LAYER,
  BUILDINGS_EXTRUSION_LAYER_ID,
  MAP_TILES_SOURCE_ID,
} from "@/lib/map/layers";

export function BuildingsLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(MAP_TILES_SOURCE_ID)) {
      console.warn(
        `[buildings] soruce "${MAP_TILES_SOURCE_ID}" not in loaded style - fix MAP_TILES_SOURCE_ID in src/lib/map/layers.ts`,
      );
      return;
    }
    if (map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)) return;

    map.addLayer({
      id: BUILDINGS_EXTRUSION_LAYER_ID,
      type: "fill-extrusion",
      source: MAP_TILES_SOURCE_ID,
      "source-layer": BUILDING_SOURCE_LAYER,
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#D9E4D6",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.9,
        "fill-extrusion-vertical-gradient": false,
      },
    });

    return () => {
      if (map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)) {
        map.removeLayer(BUILDINGS_EXTRUSION_LAYER_ID);
      }
    };
  }, [map]);

  return null;
}
