import { useEffect } from "react";
import { useMap } from "./map-context";

const SOURCE_ID = "coolroute-campus-building-cells";
const EXTRUSION_LAYER_ID = "coolroute-campus-building-extrusions";

export function CampusBuildingCellsLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (map.getLayer(EXTRUSION_LAYER_ID)) {
      map.removeLayer(EXTRUSION_LAYER_ID);
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

    map.addLayer(
      {
        id: EXTRUSION_LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        minzoom: 14,

        paint: {
          "fill-extrusion-height": ["to-number", ["get", "height_m"], 4],

          "fill-extrusion-base": 0,

          "fill-extrusion-color": [
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
          ],

          "fill-extrusion-opacity": 0.96,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer,
    );

    console.info("[buildings] Optimized campus extrusions added.");

    return () => {
      if (map.getLayer(EXTRUSION_LAYER_ID)) {
        map.removeLayer(EXTRUSION_LAYER_ID);
      }

      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  return null;
}
