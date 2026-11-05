import { useEffect } from "react";
import { useMap } from "./map-context";

const SOURCE_ID = "coolroute-campus-building-cells";
const EXTRUSION_LAYER_ID = "coolroute-campus-building-extrusions";
const FILL_LAYER_ID = "coolroute-campus-building-cells-fill";
const OUTLINE_LAYER_ID = "coolroute-campus-building-cells-outline";

export function CampusBuildingCellsLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Remove the previous diagnostic overlay, including during HMR.
    for (const id of [OUTLINE_LAYER_ID, FILL_LAYER_ID, EXTRUSION_LAYER_ID]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    if (map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/buildings-wgs84.geojson`,
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
          // DN is provisionally interpreted as height in metres.
          "fill-extrusion-height": ["to-number", ["get", "DN"], 4],

          "fill-extrusion-base": 0,

          // Taller structures get slightly darker green tones.
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["to-number", ["get", "DN"], 1],
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

    console.info("[buildings] Campus 3D extrusions added.");

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
