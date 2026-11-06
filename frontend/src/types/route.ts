export type TransportMode = 'walk' | 'bike';

export interface RouteStats {
  distance_m: number;
  duration_min: number;
  avg_heat_score: number;
  avg_utci_deg_c: number | null;
  avg_shade_fraction: number;
  heat_source: string;
  heat_source_label: string;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteOption {
  type: 'fastest' | 'cooler';
  name: string;
  geometry: GeoJSONLineString;
  stats: RouteStats;
}

export interface RouteResponse {
  mode: TransportMode;
  fastest: RouteOption;
  cooler: RouteOption;
  heat_source: string;
  heat_source_description: string;
  snapped_start: [number, number];
  snapped_end: [number, number];
}

export interface HealthResponse {
  status: string;
  walk_graph_loaded: boolean;
  bike_graph_loaded: boolean;
  nodes_count: Record<string, number>;
  edges_count: Record<string, number>;
  active_heat_source: string;
  heat_sources_available: string[];
  pilot_area: string;
}

export interface CampusPreset {
  id: string;
  name: string;
  start: [number, number]; // [lon, lat]
  end: [number, number];
  startName: string;
  endName: string;
}

