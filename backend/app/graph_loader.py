import os
import math
import shapely.geometry
import shapely.wkt
import pyproj
import osmnx as ox
import networkx as nx
from typing import Dict, Tuple, Optional
from . import config

# Projected transformer for metric distances (EPSG:4326 -> EPSG:32645)
transformer_4326_to_32645 = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32645", always_xy=True).transform

class GraphRepository:
    def __init__(self):
        self.graphs: Dict[str, nx.MultiDiGraph] = {}
        # Precomputed metric coordinates for each node {mode: {node_id: (x_32645, y_32645, lon, lat)}}
        self.node_spatial_index: Dict[str, Dict[int, Tuple[float, float, float, float]]] = {}
        self.has_utci_data: bool = False

    def load_graphs(self):
        modes = [("walk", config.WALK_GRAPHML_PATH), ("bike", config.BIKE_GRAPHML_PATH)]
        
        # Check if UTCI raster is present
        self.has_utci_data = os.path.exists(config.UTCI_RASTER_PATH)

        for mode, path in modes:
            if not os.path.exists(path):
                print(f"[GraphRepository] Warning: {path} not found. Attempting to build...", flush=True)
                continue

            print(f"[GraphRepository] Loading {mode} graph from {path}...", flush=True)
            G = ox.load_graphml(path)
            
            # Clean and prepare edge geometries and attributes
            node_index = {}
            for node, data in G.nodes(data=True):
                lon = float(data.get("x", 0.0))
                lat = float(data.get("y", 0.0))
                x_m, y_m = transformer_4326_to_32645(lon, lat)
                node_index[node] = (x_m, y_m, lon, lat)
            
            speed = config.SPEED_WALK_MPS if mode == "walk" else config.SPEED_BIKE_MPS

            for u, v, k, data in G.edges(keys=True, data=True):
                # Ensure geometry is a Shapely LineString
                if "geometry" in data and isinstance(data["geometry"], str):
                    try:
                        data["geometry"] = shapely.wkt.loads(data["geometry"])
                    except Exception:
                        pass
                if "geometry" not in data or not isinstance(data["geometry"], shapely.geometry.base.BaseGeometry):
                    u_coord = (node_index[u][2], node_index[u][3])
                    v_coord = (node_index[v][2], node_index[v][3])
                    data["geometry"] = shapely.geometry.LineString([u_coord, v_coord])

                length = float(data.get("length", 10.0))
                if length <= 0:
                    geom_32645 = shapely.ops.transform(transformer_4326_to_32645, data["geometry"])
                    length = max(1.0, geom_32645.length)
                    data["length"] = length

                # Travel time in seconds
                time_sec = length / speed
                data["travel_time_sec"] = time_sec

                # Fallback attributes if missing
                if "sun_exposure_score" not in data:
                    data["sun_exposure_score"] = 0.5
                else:
                    data["sun_exposure_score"] = float(data["sun_exposure_score"])

                if "utci_score" not in data:
                    data["utci_score"] = data["sun_exposure_score"]
                else:
                    data["utci_score"] = float(data["utci_score"])

                if "avg_shade_fraction" not in data:
                    data["avg_shade_fraction"] = 1.0 - data["sun_exposure_score"]
                else:
                    data["avg_shade_fraction"] = float(data["avg_shade_fraction"])

                if "utci_deg_c" in data and data["utci_deg_c"] is not None:
                    try:
                        data["utci_deg_c"] = float(data["utci_deg_c"])
                    except (ValueError, TypeError):
                        data["utci_deg_c"] = None

            self.graphs[mode] = G
            self.node_spatial_index[mode] = node_index
            print(f"[GraphRepository] {mode} graph ready: {len(G.nodes)} nodes, {len(G.edges)} edges", flush=True)

    def get_graph(self, mode: str) -> nx.MultiDiGraph:
        if mode not in self.graphs:
            raise KeyError(f"Graph for mode '{mode}' is not loaded.")
        return self.graphs[mode]

    def find_nearest_node(self, mode: str, lon: float, lat: float) -> Tuple[int, float, Tuple[float, float]]:
        """
        Finds the nearest node in the graph for (lon, lat).
        Returns: (node_id, distance_in_meters, (node_lon, node_lat))
        """
        if mode not in self.node_spatial_index:
            raise KeyError(f"Spatial index for mode '{mode}' not available.")

        target_x, target_y = transformer_4326_to_32645(lon, lat)
        index = self.node_spatial_index[mode]

        best_node = None
        best_dist_sq = float("inf")
        best_coords = (0.0, 0.0)

        for node_id, (x_m, y_m, n_lon, n_lat) in index.items():
            dist_sq = (x_m - target_x) ** 2 + (y_m - target_y) ** 2
            if dist_sq < best_dist_sq:
                best_dist_sq = dist_sq
                best_node = node_id
                best_coords = (n_lon, n_lat)

        distance_m = math.sqrt(best_dist_sq)
        return best_node, distance_m, best_coords

# Global singleton repository
graph_repo = GraphRepository()

