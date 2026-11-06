import { useEffect, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";

import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";

import type { LonLat, RouteKind } from "@/types/routes";

import { BUILDINGS_EXTRUSION_LAYER_ID } from "@/lib/map/layers";

const SOURCE_ID = "coolroute-campus-building-cells";
const BASE_LAYER_ID = "coolroute-campus-cell-extrusions";
const OBSTRUCTING_LAYER_ID = "coolroute-campus-cell-obstructing";

const HIDDEN_FILTER = [
  "==",
  ["get", "__coolroute_hidden_cell__"],
  true,
] as maplibregl.FilterSpecification;

const VISIBLE_FILTER = ["has", "DN"] as maplibregl.FilterSpecification;

const OLD_LAYERS = [
  "coolroute-campus-building-obstructing",
  "coolroute-campus-building-shade",
  "coolroute-campus-building-distant",
  "coolroute-campus-building-distant-outline",
  "coolroute-campus-building-zones",
  "coolroute-campus-building-zone-outlines",
];

interface Props {
  selectedRouteKind: RouteKind;
}

interface CorridorPolygonFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: {
    type: "Polygon";
    coordinates: LonLat[][];
  };
}

interface CorridorFeatureCollection {
  type: "FeatureCollection";
  features: CorridorPolygonFeature[];
}

function createCameraOcclusionCorridor(
  route: LonLat[],
  bearing: number,
  pitch: number,
): CorridorFeatureCollection {
  const maxDepthM = 40;
  const pitchRadians = (Math.max(0, Math.min(85, pitch)) * Math.PI) / 180;

  const depth = Math.min(
    maxDepthM,
    (maxDepthM * Math.tan(pitchRadians)) / Math.tan((58 * Math.PI) / 180),
  );

  const features: CorridorPolygonFeature[] = [];

  if (route.length < 2 || depth < 0.25) {
    return { type: "FeatureCollection", features };
  }

  const cameraAzimuth = ((bearing + 180) * Math.PI) / 180;

  const cameraEast = Math.sin(cameraAzimuth);
  const cameraNorth = Math.cos(cameraAzimuth);

  const sideEast = -cameraNorth;
  const sideNorth = cameraEast;

  const halfWidthM = Math.min(18, Math.max(6, depth * 0.5));

  function offset(origin: LonLat, eastM: number, northM: number): LonLat {
    const longitudeScale = 111320 * Math.cos((origin[1] * Math.PI) / 180);

    return [origin[0] + eastM / longitudeScale, origin[1] + northM / 110574];
  }

  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];

    const longitudeScale = 111320 * Math.cos((a[1] * Math.PI) / 180);

    const bx = (b[0] - a[0]) * longitudeScale;
    const by = (b[1] - a[1]) * 110574;

    if (Math.hypot(bx, by) < 0.1) continue;

    const ring: LonLat[] = [
      offset(a, -sideEast * halfWidthM, -sideNorth * halfWidthM),

      offset(a, bx - sideEast * halfWidthM, by - sideNorth * halfWidthM),

      offset(
        a,
        bx + cameraEast * depth + sideEast * halfWidthM,
        by + cameraNorth * depth + sideNorth * halfWidthM,
      ),

      offset(
        a,
        cameraEast * depth + sideEast * halfWidthM,
        cameraNorth * depth + sideNorth * halfWidthM,
      ),
    ];

    ring.push(ring[0]);

    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

function createOcclusionFilters(
  route: LonLat[],
  bearing: number,
  pitch: number,
) {
  const routeLine = {
    type: "LineString" as const,
    coordinates: route,
  };

  const corridor = createCameraOcclusionCorridor(route, bearing, pitch);

  const pitchRadians = (Math.max(0, Math.min(85, pitch)) * Math.PI) / 180;

  const heightReach = [
    "min",
    40,
    ["*", ["to-number", ["get", "DN"], 4], Math.tan(pitchRadians)],
  ];

  const isObstructing = [
    "all",
    ["<=", ["distance", routeLine], heightReach],
    ["<=", ["distance", corridor], 0.1],
  ];

  const effectiveObstruction =
    pitch < 1
      ? ["==", ["get", "__coolroute_hidden_cell__"], true]
      : isObstructing;

  return {
    normal: [
      "all",
      VISIBLE_FILTER,
      ["!", effectiveObstruction],
    ] as unknown as maplibregl.FilterSpecification,

    obstructing: [
      "all",
      VISIBLE_FILTER,
      effectiveObstruction,
    ] as unknown as maplibregl.FilterSpecification,
  };
}

async function addCampusCellLayers(
  map: MapLibreMap,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false;

  // Remove previous campus representations.
  for (const id of [...OLD_LAYERS, BASE_LAYER_ID, OBSTRUCTING_LAYER_ID]) {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  }

  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }

  // Let MapLibre fetch and parse GeoJSON through its own workers.
  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: `${import.meta.env.BASE_URL}data/buildings-wgs84.geojson`,
    maxzoom: 18,
    buffer: 32,
    tolerance: 0.05,
  } as Parameters<typeof map.addSource>[1]);

  // Keep actual OSM buildings above the raster-derived cell models.
  const beforeId = map.getLayer(BUILDINGS_EXTRUSION_LAYER_ID)
    ? BUILDINGS_EXTRUSION_LAYER_ID
    : map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;

  const dnHeight = ["to-number", ["get", "DN"], 4];

  const extrusionHeight = [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    0,
    15,
    ["*", dnHeight, 0.85],
  ];

  const cellColor = [
    "interpolate",
    ["linear"],
    dnHeight,
    1,
    "#D8E3D7",
    4,
    "#BECFBE",
    7,
    "#9FB69F",
    10,
    "#819D82",
    15,
    "#607E64",
    21,
    "#405F46",
  ];

  function addCellLayer(
    id: string,
    opacity: number,
    filter: maplibregl.FilterSpecification,
  ) {
    map.addLayer(
      {
        id,
        type: "fill-extrusion",
        source: SOURCE_ID,
        minzoom: 14,
        filter,
        paint: {
          "fill-extrusion-color": cellColor,
          "fill-extrusion-height": extrusionHeight,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": opacity,
          "fill-extrusion-vertical-gradient": true,
        },
      } as maplibregl.FillExtrusionLayerSpecification,
      beforeId,
    );
  }

  addCellLayer(BASE_LAYER_ID, 0.96, VISIBLE_FILTER);
  addCellLayer(OBSTRUCTING_LAYER_ID, 0.18, HIDDEN_FILTER);

  console.info(
    `[buildings] ${data.features.length} original 4 m campus cells added as 3D blocks.`,
  );

  return true;
}

export function CampusBuildingCellsLayer({ selectedRouteKind }: Props) {
  const map = useMap();
  const { data: routes } = useRoutes();
  const [ready, setReady] = useState(false);

  const selectedRoute =
    routes?.find((route) => route.kind === selectedRouteKind) ?? null;

  // Load and render the original cells.
  useEffect(() => {
    const mapInstance = map;

    if (!mapInstance) return;

    const controller = new AbortController();

    setReady(false);

    void addCampusCellLayers(mapInstance, controller.signal)
      .then((loaded) => {
        if (loaded && !controller.signal.aborted) {
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error("[buildings] Campus cell rendering failed:", error);
        }
      });

    return () => {
      controller.abort();

      for (const id of [OBSTRUCTING_LAYER_ID, BASE_LAYER_ID]) {
        if (mapInstance.getLayer(id)) {
          mapInstance.removeLayer(id);
        }
      }

      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  // Apply camera-aware occlusion to the individual cells.
  useEffect(() => {
    if (!map || !ready) return;

    if (!selectedRoute) {
      map.setFilter(BASE_LAYER_ID, VISIBLE_FILTER);
      map.setFilter(OBSTRUCTING_LAYER_ID, HIDDEN_FILTER);
      return;
    }

    let lastCameraKey = "";

    const updateOcclusion = () => {
      const bearing = map.getBearing();
      const pitch = map.getPitch();

      const cameraKey = `${bearing.toFixed(2)}:${pitch.toFixed(2)}`;

      if (cameraKey === lastCameraKey) return;

      lastCameraKey = cameraKey;

      const filters = createOcclusionFilters(
        selectedRoute.geometry,
        bearing,
        pitch,
      );

      map.setFilter(BASE_LAYER_ID, filters.normal);
      map.setFilter(OBSTRUCTING_LAYER_ID, filters.obstructing);
    };

    updateOcclusion();

    map.on("moveend", updateOcclusion);

    return () => {
      map.off("moveend", updateOcclusion);
    };
  }, [map, ready, selectedRoute]);

  return null;
}
