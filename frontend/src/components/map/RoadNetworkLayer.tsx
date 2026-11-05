import { useEffect } from "react";
import { useMap } from "./map-context";

const EDGES_SOURCE = "coolroute-road-network";
const EDGES_LAYER = "coolroute-road-network-lines";

export function RoadNetworkLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.addSource(EDGES_SOURCE, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/ravenshaw_edges.geojson`,
    });

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    map.addLayer(
      {
        id: EDGES_LAYER,
        type: "line",
        source: EDGES_SOURCE,
        minzoom: 14,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#829C7D",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0.8,
            17,
            1.2,
            20,
            1.6,
          ],
          "line-opacity": 0.35,
        },
      },
      firstSymbolLayer,
    );

    console.info("[roads] Campus road reference layer loaded.");

    return () => {
      if (map.getLayer(EDGES_LAYER)) map.removeLayer(EDGES_LAYER);
      if (map.getSource(EDGES_SOURCE)) map.removeSource(EDGES_SOURCE);
    };
  }, [map]);

  return null;
}
