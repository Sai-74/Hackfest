import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "./map-context";
import { useRoutes } from "@/features/routes/useRoutes";
import { heatColorFor } from "@/features/heat/heatScale";
import { buildLineIndex, type LineIndex } from "@/lib/map/lineMath";
import { INITIAL_CAMERA } from "@/lib/map/config";
import {
  CHEVRON_LAYER_ID,
  CHEVRON_SOURCE_ID,
  FASTEST_LAYER_ID,
  FASTEST_SOURCE_ID,
  WEIGHTED_BASE_LAYER_ID,
  WEIGHTED_SOURCE_ID,
} from "@/lib/map/layers";
import type { RouteOption, RouteKind } from "@/types/routes";
import { useRouteInputs } from "@/features/routes/route-input-context";

const CHEVRON_SPACING_PX = 22;
const CHEVRON_SAMPLE_STEP_M = 0.5;
const PULSE_CYCLE_MS = 1850;
const PULSE_RADIUS_PX = 48;
const PULSE_FRAME_MS = 16;
const CHEVRON_IMAGE_ID = "coolroute-chevron";

const EMPTY_FC = { type: "FeatureCollection", features: [] } as const;

function chevronImageData(): ImageData {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(10, 6);
  ctx.lineTo(23, 16);
  ctx.lineTo(10, 26);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

function scoreAt(segments: RouteOption["segments"], dist: number): number {
  if (!segments.length) return 0;
  const blendRadius = 2;

  for (let i = 1; i < segments.length; i++) {
    const boundary = segments[i].startDist;
    const start = boundary - blendRadius;
    const end = boundary + blendRadius;
    if (dist >= start && dist <= end) {
      const t = (dist - start) / (end - start);
      const eased = t * t * (3 - 2 * t);
      const previous = segments[i - 1].score;
      const next = segments[i].score;
      return previous + (next - previous) * eased;
    }
  }

  const segment = segments.find((s) => dist >= s.startDist && dist < s.endDist);
  return (segment ?? segments[segments.length - 1]).score;
}

function chevronFeatures(
  route: RouteOption,
  index: LineIndex,
  map: maplibregl.Map,
) {
  const features = [];
  let screenDistancePx = 0;
  let nextChevronPx = CHEVRON_SPACING_PX / 2;
  let previousDistanceM = 0;
  let previousPoint = map.project(index.pointAt(0));
  let id = 0;

  while (previousDistanceM < index.total) {
    const nextDistanceM = Math.min(
      previousDistanceM + CHEVRON_SAMPLE_STEP_M,
      index.total,
    );
    const nextPoint = map.project(index.pointAt(nextDistanceM));
    const segmentPixels = Math.hypot(
      nextPoint.x - previousPoint.x,
      nextPoint.y - previousPoint.y,
    );

    if (segmentPixels > 0) {
      while (screenDistancePx + segmentPixels >= nextChevronPx) {
        const t = (nextChevronPx - screenDistancePx) / segmentPixels;
        const distanceM =
          previousDistanceM + (nextDistanceM - previousDistanceM) * t;
        const [lon, lat] = index.pointAt(distanceM);

        features.push({
          type: "Feature" as const,
          id,
          properties: {
            color: heatColorFor(scoreAt(route.segments, distanceM)),
            bearing: (((index.bearingAt(distanceM) - 90) % 360) + 360) % 360,
            distanceM,
            screenDistancePx: nextChevronPx,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [lon, lat],
          },
        });
        id++;
        nextChevronPx += CHEVRON_SPACING_PX;
      }
    }

    screenDistancePx += segmentPixels;
    previousDistanceM = nextDistanceM;
    previousPoint = nextPoint;
  }

  if (features.length === 0 && screenDistancePx > 0) {
    const distanceM = index.total / 2;
    const [lon, lat] = index.pointAt(distanceM);

    features.push({
      type: "Feature" as const,
      id: 0,
      properties: {
        color: heatColorFor(scoreAt(route.segments, distanceM)),
        bearing: (((index.bearingAt(distanceM) - 90) % 360) + 360) % 360,
        distanceM,
        screenDistancePx: screenDistancePx / 2,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [lon, lat],
      },
    });
  }

  return {
    featureCollection: {
      type: "FeatureCollection" as const,
      features,
    },
    screenLengthPx: screenDistancePx,
  };
}

function hasSameGeometry(
  a: RouteOption["geometry"],
  b: RouteOption["geometry"],
): boolean {
  if (a.length !== b.length) return false;

  return a.every(
    ([lon, lat], i) =>
      Math.abs(lon - b[i][0]) < 1e-7 && Math.abs(lat - b[i][1]) < 1e-7,
  );
}

export function RoutesLayer({
  selectedRouteKind,
}: {
  selectedRouteKind: RouteKind;
}) {
  const map = useMap();
  const { data } = useRoutes();
  const fittedEndpoints = useRef<string | null>(null);
  const { origin, destination } = useRouteInputs();
  const endpointKey = `${origin[0]},${origin[1]}|${destination[0]},${destination[1]}`;
  const selectedRoute =
    data?.find((route) => route.kind === selectedRouteKind) ?? null;
  const alternateRoute =
    data?.find((route) => route.kind !== selectedRouteKind) ?? null;

  useEffect(() => {
    if (!map) return;
    if (!map.hasImage(CHEVRON_IMAGE_ID)) {
      map.addImage(CHEVRON_IMAGE_ID, chevronImageData(), { sdf: true });
    }
    map.addSource(FASTEST_SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addSource(WEIGHTED_SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addSource(CHEVRON_SOURCE_ID, { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: FASTEST_LAYER_ID,
      type: "line",
      source: FASTEST_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#394B40",
        "line-width": 2.5,
        "line-dasharray": [2, 2],
        "line-opacity": 0.9,
      },
    });
    map.addLayer({
      id: WEIGHTED_BASE_LAYER_ID,
      type: "line",
      source: WEIGHTED_SOURCE_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#CCDAD0",
        "line-width": 6,
        "line-opacity": 0.65,
      },
    });
    map.addLayer({
      id: CHEVRON_LAYER_ID,
      type: "symbol",
      source: CHEVRON_SOURCE_ID,
      layout: {
        "icon-image": CHEVRON_IMAGE_ID,
        "icon-size": 0.62,
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["feature-state", "pulse"], 0],
          0,
          ["get", "color"],
          1,
          "#FFF4CA",
        ],
        "icon-opacity": [
          "interpolate",
          ["linear"],
          ["coalesce", ["feature-state", "pulse"], 0],
          0,
          0.9,
          1,
          1,
        ],
        "icon-halo-color": "#FFF4CA",
        "icon-halo-width": [
          "*",
          ["coalesce", ["feature-state", "pulse"], 0],
          1.4,
        ],
        "icon-halo-blur": 0.6,
      },
    });
    return () => {
      for (const id of [
        CHEVRON_LAYER_ID,
        WEIGHTED_BASE_LAYER_ID,
        FASTEST_LAYER_ID,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [
        CHEVRON_SOURCE_ID,
        WEIGHTED_SOURCE_ID,
        FASTEST_SOURCE_ID,
      ]) {
        if (map.getSource(id)) map.removeSource(id);
      }
      if (map.hasImage(CHEVRON_IMAGE_ID)) map.removeImage(CHEVRON_IMAGE_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !selectedRoute || !alternateRoute) return;

    const alternateOverlapsSelected = hasSameGeometry(
      selectedRoute.geometry,
      alternateRoute.geometry,
    );

    const alternateSource = map.getSource(FASTEST_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    alternateSource?.setData(
      alternateOverlapsSelected
        ? EMPTY_FC
        : {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: alternateRoute.geometry,
            },
          },
    );

    const selectedSource = map.getSource(WEIGHTED_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;

    selectedSource?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: selectedRoute.geometry,
      },
    });

    if (fittedEndpoints.current !== endpointKey) {
      fittedEndpoints.current = endpointKey;

      const firstCoordinate = selectedRoute.geometry[0];

      const bounds = new maplibregl.LngLatBounds(
        firstCoordinate,
        firstCoordinate,
      );

      // Fit both options so either can be selected without
      // the alternative disappearing outside the viewport.
      for (const route of [selectedRoute, alternateRoute]) {
        for (const coordinate of route.geometry) {
          bounds.extend(coordinate);
        }
      }

      map.fitBounds(bounds, {
        padding: {
          top: 90,
          bottom: 220,
          left: 60,
          right: 60,
        },
        pitch: INITIAL_CAMERA.pitch,
        bearing: INITIAL_CAMERA.bearing,
        maxZoom: 17.5,
        duration: 1100,
      });
    }
  }, [map, selectedRoute, alternateRoute, endpointKey]);

  useEffect(() => {
    if (!map || !selectedRoute) return;
    const source = map.getSource(CHEVRON_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source || selectedRoute.geometry.length < 2) return;
    const index = buildLineIndex(selectedRoute.geometry);
    if (!Number.isFinite(index.total) || index.total <= 0) return;
    let featureData = chevronFeatures(selectedRoute, index, map);
    source.setData(featureData.featureCollection);
    let raf = 0;
    let lastFrame = 0;
    let activeIds = new Set<number>();

    const rebuildChevrons = () => {
      for (const id of activeIds) {
        map.setFeatureState({ source: CHEVRON_SOURCE_ID, id }, { pulse: 0 });
      }

      activeIds.clear();
      featureData = chevronFeatures(selectedRoute, index, map);
      source.setData(featureData.featureCollection);
    };

    map.on("moveend", rebuildChevrons);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => {
        map.off("moveend", rebuildChevrons);
      };
    }

    const start = performance.now();
    const tick = (now: number) => {
      if (now - lastFrame >= PULSE_FRAME_MS) {
        lastFrame = now;
        const progress = ((now - start) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
        const pulseDistancePx = progress * featureData.screenLengthPx;
        const nextActiveIds = new Set<number>();

        for (const feature of featureData.featureCollection.features) {
          const id = feature.id as number;
          const distance = feature.properties.screenDistancePx;
          const delta = Math.abs(distance - pulseDistancePx);
          if (delta <= PULSE_RADIUS_PX) {
            const raw = 1 - delta / PULSE_RADIUS_PX;
            const intensity = raw * raw * (3 - 2 * raw);
            map.setFeatureState(
              { source: CHEVRON_SOURCE_ID, id },
              { pulse: intensity },
            );
            nextActiveIds.add(id);
          }
        }

        for (const id of activeIds) {
          if (!nextActiveIds.has(id)) {
            map.setFeatureState(
              { source: CHEVRON_SOURCE_ID, id },
              { pulse: 0 },
            );
          }
        }

        activeIds = nextActiveIds;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      map.off("moveend", rebuildChevrons);
      cancelAnimationFrame(raf);

      for (const id of activeIds) {
        map.setFeatureState({ source: CHEVRON_SOURCE_ID, id }, { pulse: 0 });
      }
    };
  }, [map, selectedRoute]);

  return null;
}
