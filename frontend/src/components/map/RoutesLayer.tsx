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
import type { RouteOption } from "@/types/routes";

const CHEVRON_SPACING_M = 26;
const CHEVRON_SPEED_MPS = 5;
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
  const seg = segments.find((s) => dist >= s.startDist && dist < s.endDist);
  return (seg ?? segments[segments.length - 1]).score;
}

function chevronFeatures(
  route: RouteOption,
  index: LineIndex,
  offsetM: number,
) {
  const count = Math.max(2, Math.floor(index.total / CHEVRON_SPACING_M));
  const features = [];
  for (let i = 0; i < count; i++) {
    const dist = (i * CHEVRON_SPACING_M + offsetM) % index.total;
    const [lon, lat] = index.pointAt(dist);
    features.push({
      type: "Feature" as const,
      properties: {
        color: heatColorFor(scoreAt(route.segments, dist)),
        bearing: index.bearingAt(dist),
      },
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

export function RoutesLayer() {
  const map = useMap();
  const { data } = useRoutes();
  const fitted = useRef(false);

  const weighted = data?.find((r) => r.kind === "weighted") ?? null;
  const fastest = data?.find((r) => r.kind === "fastest") ?? null;

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
        "icon-size": 0.8,
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-color": ["get", "color"],
        "icon-opacity": 0.95,
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
    if (!map || !weighted || !fastest) return;
    (map.getSource(FASTEST_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: fastest.geometry },
    });
    (map.getSource(WEIGHTED_SOURCE_ID) as maplibregl.GeoJSONSource)?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: weighted.geometry },
    });
    if (!fitted.current) {
      fitted.current = true;
      const bounds = new maplibregl.LngLatBounds(
        weighted.geometry[0],
        weighted.geometry[0],
      );
      for (const c of weighted.geometry) bounds.extend(c);
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 150, left: 60, right: 60 },
        pitch: INITIAL_CAMERA.pitch,
        bearing: INITIAL_CAMERA.bearing,
        maxZoom: 17.5,
        duration: 1400,
      });
    }
  }, [map, weighted, fastest]);

  useEffect(() => {
    if (!map || !weighted) return;
    const source = map.getSource(CHEVRON_SOURCE_ID) as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;
    const index = buildLineIndex(weighted.geometry);
    source.setData(chevronFeatures(weighted, index, 0));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      source.setData(
        chevronFeatures(
          weighted,
          index,
          ((now - start) / 1000) * CHEVRON_SPEED_MPS,
        ),
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map, weighted]);

  return null;
}
