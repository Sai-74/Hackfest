import { buildLineIndex } from "@/lib/map/lineMath";
import type { LonLat, RouteOption, RouteKind } from "@/types/routes";
import { treeShadeCoverageAt } from "@/features/shade/treeShade";

interface NodeFeature {
  properties: {
    osmid: number;
  };
  geometry: {
    type: "Point";
    coordinates: LonLat;
  };
}

interface EdgeFeature {
  properties: {
    u: number;
    v: number;
    length: number;
  };
  geometry: {
    type: "LineString";
    coordinates: LonLat[];
  };
}

interface FeatureCollection<T> {
  type: "FeatureCollection";
  features: T[];
}

interface GraphEdge {
  to: number;
  length: number;
  coordinates: LonLat[];
}

interface CampusGraph {
  nodes: NodeFeature[];
  graph: Map<number, GraphEdge[]>;
}

let campusGraphPromise: Promise<CampusGraph> | null = null;

function loadCampusGraph(): Promise<CampusGraph> {
  if (!campusGraphPromise) {
    campusGraphPromise = (async () => {
      const base = import.meta.env.BASE_URL;

      const [nodesResponse, edgesResponse] = await Promise.all([
        fetch(`${base}data/ravenshaw_nodes.geojson`),
        fetch(`${base}data/ravenshaw_edges.geojson`),
      ]);

      if (!nodesResponse.ok || !edgesResponse.ok) {
        throw new Error("Could not load the campus road network.");
      }

      const nodes =
        (await nodesResponse.json()) as FeatureCollection<NodeFeature>;

      const edges =
        (await edgesResponse.json()) as FeatureCollection<EdgeFeature>;

      return {
        nodes: nodes.features,
        graph: buildGraph(nodes.features, edges.features),
      };
    })().catch((error: unknown) => {
      campusGraphPromise = null;
      throw error;
    });
  }

  return campusGraphPromise;
}

interface PreviousEdge {
  from: number;
  edge: GraphEdge;
}

function distanceMeters(a: LonLat, b: LonLat): number {
  const latitude = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const dx = (b[0] - a[0]) * 111320 * Math.cos(latitude);
  const dy = (b[1] - a[1]) * 110574;

  return Math.hypot(dx, dy);
}

function createShadeHeatSegments(
  index: ReturnType<typeof buildLineIndex>,
): RouteOption["segments"] {
  const SAMPLE_INTERVAL_M = 4;

  // Synthetic exposed-road heat and maximum shade benefit.
  const BASE_HEAT = 82;
  const MAX_SHADE_REDUCTION = 55;

  const segments: RouteOption["segments"] = [];

  for (
    let startDist = 0;
    startDist < index.total;
    startDist += SAMPLE_INTERVAL_M
  ) {
    const endDist = Math.min(startDist + SAMPLE_INTERVAL_M, index.total);

    // Average coverage across each small route segment.
    const samples = [0.25, 0.5, 0.75];

    const coverage =
      samples.reduce((total, fraction) => {
        const distance = startDist + (endDist - startDist) * fraction;

        return total + treeShadeCoverageAt(index.pointAt(distance));
      }, 0) / samples.length;

    const score = Math.round(BASE_HEAT - coverage * MAX_SHADE_REDUCTION);

    segments.push({
      startDist,
      endDist,
      score,
    });
  }

  return segments;
}

function nearestNode(coordinate: LonLat, nodes: NodeFeature[]): NodeFeature {
  let closest: NodeFeature | null = null;
  let minimumDistance = Infinity;

  for (const node of nodes) {
    const distance = distanceMeters(coordinate, node.geometry.coordinates);

    if (distance < minimumDistance) {
      minimumDistance = distance;
      closest = node;
    }
  }

  if (!closest || minimumDistance > 100) {
    throw new Error("No campus road node found near the requested location.");
  }

  return closest;
}

function buildGraph(
  nodes: NodeFeature[],
  edges: EdgeFeature[],
): Map<number, GraphEdge[]> {
  const graph = new Map<number, GraphEdge[]>();

  for (const node of nodes) {
    graph.set(node.properties.osmid, []);
  }

  for (const feature of edges) {
    const { u, v, length } = feature.properties;

    const outgoing = graph.get(u);

    if (!outgoing || !graph.has(v)) {
      throw new Error(`Invalid road edge: ${u} → ${v}`);
    }

    outgoing.push({
      to: v,
      length,
      coordinates: feature.geometry.coordinates,
    });
  }

  return graph;
}

function shortestPath(
  graph: Map<number, GraphEdge[]>,
  start: number,
  destination: number,
  avoidDirectEdge = false,
): GraphEdge[] {
  const distances = new Map<number, number>();
  const previous = new Map<number, PreviousEdge>();
  const unvisited = new Set(graph.keys());

  for (const node of graph.keys()) {
    distances.set(node, Infinity);
  }

  distances.set(start, 0);

  while (unvisited.size > 0) {
    let current: number | null = null;
    let bestDistance = Infinity;

    for (const node of unvisited) {
      const distance = distances.get(node) ?? Infinity;

      if (distance < bestDistance) {
        bestDistance = distance;
        current = node;
      }
    }

    if (current === null || bestDistance === Infinity) break;

    if (current === destination) break;

    unvisited.delete(current);

    for (const edge of graph.get(current) ?? []) {
      if (avoidDirectEdge && current === start && edge.to === destination) {
        continue;
      }
      if (!unvisited.has(edge.to)) continue;

      const candidate = bestDistance + edge.length;

      if (candidate < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, candidate);
        previous.set(edge.to, {
          from: current,
          edge,
        });
      }
    }
  }

  if (start !== destination && !previous.has(destination)) {
    throw new Error("No road route exists between these locations.");
  }

  const result: GraphEdge[] = [];
  let cursor = destination;

  while (cursor !== start) {
    const previousStep = previous.get(cursor);

    if (!previousStep) {
      throw new Error("Could not reconstruct the road route.");
    }

    result.unshift(previousStep.edge);
    cursor = previousStep.from;
  }

  return result;
}

function buildRouteGeometry(
  origin: LonLat,
  destination: LonLat,
  path: GraphEdge[],
): LonLat[] {
  const geometry: LonLat[] = [origin];

  for (const edge of path) {
    for (const coordinate of edge.coordinates) {
      const last = geometry[geometry.length - 1];

      if (distanceMeters(last, coordinate) > 0.1) {
        geometry.push(coordinate);
      }
    }
  }

  const last = geometry[geometry.length - 1];

  if (distanceMeters(last, destination) > 0.1) {
    geometry.push(destination);
  }

  return geometry;
}

export async function mockRouteOptions(
  origin: LonLat,
  destination: LonLat,
): Promise<RouteOption[]> {
  if (distanceMeters(origin, destination) < 1) {
    throw new Error("Origin and destination must be at least 1 metre apart.");
  }

  const { nodes, graph } = await loadCampusGraph();

  const originNode = nearestNode(origin, nodes);
  const destinationNode = nearestNode(destination, nodes);

  const start = originNode.properties.osmid;
  const end = destinationNode.properties.osmid;

  // Fastest: shortest distance through the road graph.
  const fastestPath = shortestPath(graph, start, end);

  // Recommended: alternative path for the demo.
  // Fall back to the fastest path if no alternative exists.
  let recommendedPath: GraphEdge[];

  try {
    recommendedPath = shortestPath(graph, start, end, true);
  } catch {
    recommendedPath = fastestPath;
  }

  function createRoute(kind: RouteKind, path: GraphEdge[]): RouteOption {
    const geometry = buildRouteGeometry(origin, destination, path);

    const index = buildLineIndex(geometry);

    if (!Number.isFinite(index.total) || index.total <= 0) {
      throw new Error(`Generated ${kind} route has invalid geometry.`);
    }

    return {
      id: `road-${kind}`,
      kind,
      geometry,
      segments: createShadeHeatSegments(index),
      summary: {
        distanceM: Math.round(index.total),
        durationMin: Math.max(1, Math.ceil(index.total / 80)),
      },
    };
  }

  return [
    createRoute("fastest", fastestPath),
    createRoute("weighted", recommendedPath),
  ];
}
