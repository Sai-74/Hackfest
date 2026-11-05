import { useEffect } from "react";
import { useMap } from "./map-context";

const EDGES_SOURCE = "coolroute-road-network";
const NODES_SOURCE = "coolroute-road-nodes";

const EDGES_LAYER = "coolroute-road-network-lines";
const NODES_LAYER = "coolroute-road-network-nodes";

export function RoadNetworkLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    map.addSource(EDGES_SOURCE, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/ravenshaw_edges.geojson`,
    });

    map.addSource(NODES_SOURCE, {
      type: "geojson",
      data: `${import.meta.env.BASE_URL}data/ravenshaw_nodes.geojson`,
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
            1.2,
            17,
            2.5,
            20,
            3.5,
          ],
          "line-opacity": 0.85,
        },
      },
      firstSymbolLayer,
    );

    map.addLayer(
      {
        id: NODES_LAYER,
        type: "circle",
        source: NODES_SOURCE,
        minzoom: 17,
        paint: {
          "circle-radius": 3,
          "circle-color": "#F4C86A",
          "circle-stroke-color": "#394B40",
          "circle-stroke-width": 1,
        },
      },
      firstSymbolLayer,
    );

    console.info("[roads] Campus road network loaded.");

    return () => {
      if (map.getLayer(NODES_LAYER)) map.removeLayer(NODES_LAYER);
      if (map.getLayer(EDGES_LAYER)) map.removeLayer(EDGES_LAYER);

      if (map.getSource(NODES_SOURCE)) map.removeSource(NODES_SOURCE);
      if (map.getSource(EDGES_SOURCE)) map.removeSource(EDGES_SOURCE);
    };
  }, [map]);

  return null;
}
