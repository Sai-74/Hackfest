import { useEffect } from "react";
import { useMap } from "./map-context";
import { DEMO_TREES, type DemoTree } from "@/services/mock/demoTrees";
import type { LonLat } from "@/types/routes";

const TREE_SOURCE = "coolroute-tree-models";
const TREE_LAYER = "coolroute-tree-extrusions";

const SHADE_SOURCE = "coolroute-tree-shade";
const SHADE_LAYER = "coolroute-tree-shade-polygons";

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

interface ShadePolygonFeature {
  type: "Feature";
  id: string;
  properties: {
    opacity: number;
  };
  geometry: {
    type: "Polygon";
    coordinates: LonLat[][];
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

      // Broad lower canopy
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

      // Small crown at the top
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

function createShadeFeatures(): ShadePolygonFeature[] {
  const features: ShadePolygonFeature[] = [];

  for (const tree of DEMO_TREES) {
    // Wide, faint edge of the shade patch.
    features.push({
      type: "Feature",
      id: `${tree.id}-shade-outer`,
      properties: {
        opacity: 0.045,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          polygonRing(
            tree.shadeCenter,
            tree.shadeRadiusM * 1.45,
            16,
            tree.rotationDeg,
          ),
        ],
      },
    });

    // Darker centre of the shaded road patch.
    features.push({
      type: "Feature",
      id: `${tree.id}-shade-inner`,
      properties: {
        opacity: 0.13,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          polygonRing(
            tree.shadeCenter,
            tree.shadeRadiusM,
            16,
            tree.rotationDeg,
          ),
        ],
      },
    });
  }

  return features;
}

export function TreeShadeLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Clean up existing layers during hot reload or effect replay.
    for (const id of [TREE_LAYER, SHADE_LAYER]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }

    for (const id of [TREE_SOURCE, SHADE_SOURCE]) {
      if (map.getSource(id)) map.removeSource(id);
    }

    const firstSymbolLayer = map
      .getStyle()
      .layers.find((layer) => layer.type === "symbol")?.id;

    map.addSource(SHADE_SOURCE, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: createShadeFeatures(),
      },
      maxzoom: 18,
      buffer: 32,
      tolerance: 0.1,
    });

    map.addLayer(
      {
        id: SHADE_LAYER,
        type: "fill",
        source: SHADE_SOURCE,
        minzoom: 15,
        paint: {
          "fill-color": "#354B3A",
          "fill-opacity": ["get", "opacity"],
          "fill-antialias": true,
        },
      },
      firstSymbolLayer,
    );

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
      `[trees] ${DEMO_TREES.length} low-poly trees and shade patches added.`,
    );

    return () => {
      for (const id of [TREE_LAYER, SHADE_LAYER]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }

      for (const id of [TREE_SOURCE, SHADE_SOURCE]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    };
  }, [map]);

  return null;
}
