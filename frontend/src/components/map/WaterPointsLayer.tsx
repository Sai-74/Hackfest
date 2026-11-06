import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "./map-context";
import { DEMO_WATER_POINTS } from "@/services/mock/demoWater";

const SOURCE_ID = "coolroute-water-points";
const BACKGROUND_LAYER = "coolroute-water-point-background";
const ICON_LAYER = "coolroute-water-point-icons";
const ICON_ID = "coolroute-water-drop";

function createWaterDropImage(): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create water point icon.");
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();

  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(25, 16, 12, 30, 12, 42);
  ctx.bezierCurveTo(12, 53, 21, 60, 32, 60);
  ctx.bezierCurveTo(43, 60, 52, 53, 52, 42);
  ctx.bezierCurveTo(52, 30, 39, 16, 32, 4);

  ctx.closePath();
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

function createWaterFeatureCollection() {
  return {
    type: "FeatureCollection" as const,
    features: DEMO_WATER_POINTS.map((point) => ({
      type: "Feature" as const,
      id: point.id,
      properties: {
        id: point.id,
        name: point.name,
      },
      geometry: {
        type: "Point" as const,
        coordinates: point.position,
      },
    })),
  };
}

export function WaterPointsLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (map.getLayer(ICON_LAYER)) map.removeLayer(ICON_LAYER);
    if (map.getLayer(BACKGROUND_LAYER)) {
      map.removeLayer(BACKGROUND_LAYER);
    }

    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    if (map.hasImage(ICON_ID)) map.removeImage(ICON_ID);

    map.addImage(ICON_ID, createWaterDropImage(), {
      sdf: true,
      pixelRatio: 2,
    });

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: createWaterFeatureCollection(),
    });

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    // Pale circular backing.
    map.addLayer(
      {
        id: BACKGROUND_LAYER,
        type: "circle",
        source: SOURCE_ID,
        minzoom: 14,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            7,
            17,
            10,
            20,
            12,
          ],
          "circle-color": "#E8F5F7",
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 2,
        },
      },
      firstSymbolLayer,
    );

    // Custom water-drop icon.
    map.addLayer(
      {
        id: ICON_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        minzoom: 14,
        layout: {
          "icon-image": ICON_ID,
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0.42,
            17,
            0.55,
            20,
            0.65,
          ],
          "icon-anchor": "center",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-color": "#2596BE",
          "icon-halo-color": "#FFFFFF",
          "icon-halo-width": 0.7,
        },
      },
      firstSymbolLayer,
    );

    // Small informational popup when a point is clicked.
    const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const name = String(feature.properties?.name ?? "Drinking water");

      const content = document.createElement("div");
      content.className = "p-1";

      const title = document.createElement("strong");
      title.textContent = name;

      const subtitle = document.createElement("p");
      subtitle.textContent = "Synthetic demo location";
      subtitle.style.margin = "4px 0 0";
      subtitle.style.fontSize = "11px";
      subtitle.style.color = "#66806C";

      content.append(title, subtitle);

      new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        offset: 14,
        maxWidth: "180px",
      })
        .setLngLat(event.lngLat)
        .setDOMContent(content)
        .addTo(map);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", ICON_LAYER, handleClick);
    map.on("mouseenter", ICON_LAYER, handleMouseEnter);
    map.on("mouseleave", ICON_LAYER, handleMouseLeave);

    console.info(
      `[water] ${DEMO_WATER_POINTS.length} drinking-water points added.`,
    );

    return () => {
      map.off("click", ICON_LAYER, handleClick);
      map.off("mouseenter", ICON_LAYER, handleMouseEnter);
      map.off("mouseleave", ICON_LAYER, handleMouseLeave);

      map.getCanvas().style.cursor = "";

      if (map.getLayer(ICON_LAYER)) map.removeLayer(ICON_LAYER);
      if (map.getLayer(BACKGROUND_LAYER)) {
        map.removeLayer(BACKGROUND_LAYER);
      }

      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      if (map.hasImage(ICON_ID)) map.removeImage(ICON_ID);
    };
  }, [map]);

  return null;
}
