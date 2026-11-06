import { useEffect } from "react";
import type { ExpressionSpecification } from "maplibre-gl";

import { useMap } from "./map-context";
import { DEMO_TREES, type DemoTree } from "@/services/mock/demoTrees";
import type { LonLat } from "@/types/routes";

const TREE_SOURCE = "coolroute-tree-models";
const TREE_LAYER = "coolroute-tree-extrusions";

const SHADE_SOURCE = "coolroute-tree-shade";
const SHADE_OUTER_LAYER = "coolroute-tree-shade-soft";
const SHADE_CORE_LAYER = "coolroute-tree-shade-core";

const LEGACY_SHADE_LAYER = "coolroute-tree-shade-polygons";

interface TreePolygonFeature {
  type: "Feature";
  id: string;
  properties: {
    tree_id: string;
    part: string;
    base_m: number;
    height_m: number;
    color: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: LonLat[][];
  };
}

interface ShadePointFeature {
  type: "Feature";
  id: string;
  properties: {
    radius_m: number;
    opacity: number;
  };
  geometry: {
    type: "Point";
    coordinates: LonLat;
  };
}

function polygonRing(
  center: LonLat,
  radiusM: number,
  sides: number,
  rotationDeg: number,
  irregularity = 0,
): LonLat[] {
  const [longitude, latitude] = center;
  const latitudeFactor = Math.cos((latitude * Math.PI) / 180);

  const coordinates: LonLat[] = [];

  for (let i = 0; i < sides; i++) {
    const angle = ((rotationDeg + (i * 360) / sides) * Math.PI) / 180;

    const variation = i % 2 === 0 ? 1 : 1 - irregularity;

    const east = Math.cos(angle) * radiusM * variation;
    const north = Math.sin(angle) * radiusM * variation;

    coordinates.push([
      longitude + east / (111320 * latitudeFactor),
      latitude + north / 110574,
    ]);
  }

  coordinates.push(coordinates[0]!);

  return coordinates;
}

function createTreeFeature(
  tree: DemoTree,
  part: string,
  radiusM: number,
  baseM: number,
  heightM: number,
  color: string,
  sides: number,
  rotationOffset = 0,
): TreePolygonFeature {
  return {
    type: "Feature",
    id: `${tree.id}-${part}`,
    properties: {
      tree_id: tree.id,
      part,
      base_m: baseM,
      height_m: heightM,
      color,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        polygonRing(
          tree.position,
          radiusM,
          sides,
          tree.rotationDeg + rotationOffset,
          part === "trunk" ? 0 : 0.12,
        ),
      ],
    },
  };
}

function createTreeFeatures(): TreePolygonFeature[] {
  const features: TreePolygonFeature[] = [];

  for (const tree of DEMO_TREES) {
    const trunkHeight = tree.heightM * 0.3;

    features.push(
      // Trunk
      createTreeFeature(tree, "trunk", 0.34, 0, trunkHeight, "#806A50", 4, 45),

      // Lower canopy
      createTreeFeature(
        tree,
        "lower-canopy",
        tree.canopyRadiusM,
        trunkHeight * 0.85,
        tree.heightM * 0.69,
        tree.lowerColor,
        8,
      ),

      // Middle canopy
      createTreeFeature(
        tree,
        "middle-canopy",
        tree.canopyRadiusM * 0.73,
        tree.heightM * 0.52,
        tree.heightM * 0.88,
        tree.upperColor,
        8,
        12,
      ),

      // Top crown
      createTreeFeature(
        tree,
        "top-canopy",
        tree.canopyRadiusM * 0.42,
        tree.heightM * 0.75,
        tree.heightM,
        tree.crownColor,
        6,
        25,
      ),
    );
  }

  return features;
}

function createShadeFeatures(): ShadePointFeature[] {
  return DEMO_TREES.map((tree) => ({
    type: "Feature",
    id: `${tree.id}-shade`,
    properties: {
      radius_m: tree.shadeRadiusM,
      opacity: 0.28,
    },
    geometry: {
      type: "Point",
      coordinates: tree.shadeCenter,
    },
  }));
}

export function TreeShadeLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Clean up existing layers, including the previous polygon implementation.
    for (const id of [
      TREE_LAYER,
      SHADE_CORE_LAYER,
      SHADE_OUTER_LAYER,
      LEGACY_SHADE_LAYER,
    ]) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    }

    for (const id of [TREE_SOURCE, SHADE_SOURCE]) {
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    }

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    // --------------------------------------------------
    // SHADE SOURCE
    // --------------------------------------------------

    map.addSource(SHADE_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: createShadeFeatures(),
      },
    });

    // Zoom-dependent ground radius in screen pixels.
    // Outer radius creates the broad feathered shadow.
    const outerRadius: ExpressionSpecification = [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      ["*", ["get", "radius_m"], 0.34],
      16,
      ["*", ["get", "radius_m"], 1.35],
      18,
      ["*", ["get", "radius_m"], 5.39],
      20,
      ["*", ["get", "radius_m"], 21.55],
    ];

    // Smaller core preserves some visual depth.
    const coreRadius: ExpressionSpecification = [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      ["*", ["get", "radius_m"], 0.19],
      16,
      ["*", ["get", "radius_m"], 0.76],
      18,
      ["*", ["get", "radius_m"], 3.4],
      20,
      ["*", ["get", "radius_m"], 13.62],
    ];

    // Broad, very soft outer shadow.
    map.addLayer(
      {
        id: SHADE_OUTER_LAYER,
        type: "circle",
        source: SHADE_SOURCE,
        minzoom: 15,
        paint: {
          "circle-radius": outerRadius,
          "circle-color": "#293A2F",
          "circle-opacity": ["*", ["get", "opacity"], 0.75],
          "circle-blur": 0.95,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map",
        },
      },
      firstSymbolLayer,
    );

    // Slightly denser but still feathered centre.
    map.addLayer(
      {
        id: SHADE_CORE_LAYER,
        type: "circle",
        source: SHADE_SOURCE,
        minzoom: 15,
        paint: {
          "circle-radius": coreRadius,
          "circle-color": "#293A2F",
          "circle-opacity": ["*", ["get", "opacity"], 0.95],
          "circle-blur": 0.88,
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map",
        },
      },
      firstSymbolLayer,
    );

    // --------------------------------------------------
    // TREE SOURCE
    // --------------------------------------------------

    map.addSource(TREE_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: createTreeFeatures(),
      },
      maxzoom: 18,
      buffer: 64,
      tolerance: 0.1,
    });

    map.addLayer(
      {
        id: TREE_LAYER,
        type: "fill-extrusion",
        source: TREE_SOURCE,
        minzoom: 15,
        paint: {
          "fill-extrusion-height": ["get", "height_m"],
          "fill-extrusion-base": ["get", "base_m"],
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbolLayer,
    );

    console.info(
      `[trees] ${DEMO_TREES.length} low-poly trees and soft shade patches added.`,
    );

    return () => {
      for (const id of [TREE_LAYER, SHADE_CORE_LAYER, SHADE_OUTER_LAYER]) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }

      for (const id of [TREE_SOURCE, SHADE_SOURCE]) {
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      }
    };
  }, [map]);

  return null;
}
