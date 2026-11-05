import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";

const SOURCE_ID = "coolroute-route-waypoints";
const LAYER_ID = "coolroute-route-waypoint-circles";

const EMPTY_FC = {
  type: "FeatureCollection" as const,
  features: [],
};

export function RouteWaypointsLayer() {
  const map = useMap();
  const { data } = useRoutes();

  const route = data?.find((r) => r.kind === "weighted") ?? data?.[0] ?? null;

  useEffect(() => {
    if (!map) return;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY_FC,
    });

    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          5,
          18,
          8,
          20,
          10,
        ],
        "circle-color": [
          "match",
          ["get", "role"],
          "origin",
          "#628662",
          "#D99B42",
        ],
        "circle-stroke-color": "#FFFFFF",
        "circle-stroke-width": 2,
        "circle-pitch-alignment": "viewport",
        "circle-pitch-scale": "viewport",
      },
    });

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !route || route.geometry.length < 2) return;

    const source = map.getSource(SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { role: "origin" },
          geometry: {
            type: "Point",
            coordinates: route.geometry[0],
          },
        },
        {
          type: "Feature",
          properties: { role: "destination" },
          geometry: {
            type: "Point",
            coordinates: route.geometry[route.geometry.length - 1],
          },
        },
      ],
    });
  }, [map, route]);

  return null;
}
