import { DEMO_DESTINATION, DEMO_ORIGIN } from "@/lib/map/config";
import { buildLineIndex } from "@/lib/map/lineMath";
import type { LonLat, RouteOption } from "@/types/routes";

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

export async function mockRouteOptions(): Promise<RouteOption[]> {
  const base = import.meta.env.BASE_URL;

  const [nodesResponse, edgesResponse] = await Promise.all([
    fetch(`${base}data/ravenshaw_nodes.geojson`),
    fetch(`${base}data/ravenshaw_edges.geojson`),
  ]);

  if (!nodesResponse.ok || !edgesResponse.ok) {
    throw new Error("Could not load the campus road network.");
  }

  const nodes = (await nodesResponse.json()) as FeatureCollection<NodeFeature>;

  const edges = (await edgesResponse.json()) as FeatureCollection<EdgeFeature>;

  const originNode = nearestNode(DEMO_ORIGIN, nodes.features);
  const destinationNode = nearestNode(DEMO_DESTINATION, nodes.features);

  const graph = buildGraph(nodes.features, edges.features);

  const path = shortestPath(
    graph,
    originNode.properties.osmid,
    destinationNode.properties.osmid,
  );

  const geometry = buildRouteGeometry(DEMO_ORIGIN, DEMO_DESTINATION, path);

  const index = buildLineIndex(geometry);

  if (!Number.isFinite(index.total) || index.total <= 0) {
    throw new Error("Generated road route has invalid geometry.");
  }

  // Temporary demo heat data until the backend supplies
  // actual environmental scores for each road segment.
  const segments = [
    {
      startDist: 0,
      endDist: index.total * 0.5,
      score: 28,
    },
    {
      startDist: index.total * 0.5,
      endDist: index.total,
      score: 72,
    },
  ];

  const shared = {
    geometry,
    segments,
    summary: {
      distanceM: Math.round(index.total),
      durationMin: Math.max(1, Math.ceil(index.total / 80)),
    },
  };

  return [
    {
      ...shared,
      id: "road-fastest",
      kind: "fastest",
    },
    {
      ...shared,
      id: "road-weighted",
      kind: "weighted",
    },
  ];
}
