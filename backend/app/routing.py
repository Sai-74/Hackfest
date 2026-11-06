import math
import networkx as nx
from typing import List, Tuple, Dict, Any, Optional
from fastapi import HTTPException
from . import config
from .graph_loader import graph_repo
from .models import (
    RouteRequest,
    RouteResponse,
    RouteOption,
    RouteStats,
    GeoJSONLineString,
    FrontendRouteOption,
    FrontendRouteSegment,
    FrontendRouteSummary,
)
from .shadows import calculate_edge_shadow_metrics


def get_heat_score(edge_data: Dict[str, Any], heat_source: str) -> float:
    """
    Extracts normalized heat score (0.0 to 1.0) based on selected heat source.
    """
    if heat_source == "utci":
        score = edge_data.get("utci_score")
        if score is not None:
            return float(score)
    # Default / fallback to sun exposure score
    return float(edge_data.get("sun_exposure_score", 0.5))


def get_edge_fastest_cost(edge_data: Dict[str, Any]) -> float:
    return float(edge_data.get("travel_time_sec", 1.0))


def get_edge_cooler_cost(edge_data: Dict[str, Any], heat_weight: float, heat_source: str) -> float:
    time_sec = float(edge_data.get("travel_time_sec", 1.0))
    h = get_heat_score(edge_data, heat_source)
    # Ensure heat score is strictly bounded [0, 1]
    h = max(0.0, min(1.0, h))
    return time_sec * (1.0 + heat_weight * h)


def find_best_edge_key(G: nx.MultiDiGraph, u: int, v: int, objective: str, heat_weight: float, heat_source: str) -> Tuple[int, Dict[str, Any]]:
    """
    Selects the specific key for parallel edges between u and v that minimizes the chosen objective.
    """
    edges = G[u][v]
    if objective == "fastest":
        best_k = min(
            edges.keys(), key=lambda k: get_edge_fastest_cost(edges[k]))
    else:
        best_k = min(edges.keys(), key=lambda k: get_edge_cooler_cost(
            edges[k], heat_weight, heat_source))
    return best_k, edges[best_k]


def compute_single_route(
    G: nx.MultiDiGraph,
    source: int,
    target: int,
    objective: str,
    heat_weight: float,
    heat_source: str
) -> RouteOption:
    """
    Computes a route using Dijkstra's algorithm for the specified objective ('fastest' or 'cooler').
    """
    if objective == "fastest":
        def multi_weight(u, v, multiedges):
            return min(get_edge_fastest_cost(d) for d in multiedges.values())
    else:
        def multi_weight(u, v, multiedges):
            return min(get_edge_cooler_cost(d, heat_weight, heat_source) for d in multiedges.values())

    try:
        node_path = nx.shortest_path(
            G, source=source, target=target, weight=multi_weight, method="dijkstra")
    except nx.NetworkXNoPath:
        raise HTTPException(
            status_code=404,
            detail=f"No route found between selected points for objective '{
                objective}'. Nodes may be in disconnected network components."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Routing calculation failed: {str(e)}")

    if len(node_path) < 2:
        # Same start and end node
        node = G.nodes[source]
        lon, lat = float(node.get("x", 0.0)), float(node.get("y", 0.0))
        return RouteOption(
            type=objective,
            name="Fastest Route" if objective == "fastest" else "Cooler Route",
            geometry=GeoJSONLineString(type="LineString", coordinates=[
                                       [lon, lat], [lon, lat]]),
            stats=RouteStats(
                distance_m=1.0,
                duration_min=0.01,
                avg_heat_score=0.0,
                avg_utci_deg_c=None,
                avg_shade_fraction=0.0,
                heat_source=heat_source,
                heat_source_label="UTCI-based heat" if heat_source == "utci" else "Relative Sun-Exposure"
            )
        )

    # Reconstruct route coordinates and compute aggregate statistics
    full_coords: List[List[float]] = []
    total_distance_m = 0.0
    total_duration_sec = 0.0
    weighted_heat_sum = 0.0
    weighted_shade_sum = 0.0
    utci_len_sum = 0.0
    utci_weighted_sum = 0.0

    for i in range(len(node_path) - 1):
        u = node_path[i]
        v = node_path[i + 1]
        k, edge_data = find_best_edge_key(
            G, u, v, objective, heat_weight, heat_source)

        length = float(edge_data.get("length", 1.0))
        time_sec = float(edge_data.get("travel_time_sec", 1.0))
        h_score = get_heat_score(edge_data, heat_source)
        shade_frac = float(edge_data.get("avg_shade_fraction", 0.0))
        utci_val = edge_data.get("utci_deg_c")

        total_distance_m += length
        total_duration_sec += time_sec
        weighted_heat_sum += length * h_score
        weighted_shade_sum += length * shade_frac

        if utci_val is not None and not math.isnan(float(utci_val)):
            utci_len_sum += length
            utci_weighted_sum += length * float(utci_val)

        # Coordinate sequence from edge geometry
        geom = edge_data.get("geometry")
        edge_coords = list(geom.coords) if geom is not None else []
        if len(edge_coords) >= 2:
            u_node = G.nodes[u]
            u_xy = (float(u_node["x"]), float(u_node["y"]))
            # Check orientation
            start_dist = (edge_coords[0][0] - u_xy[0]
                          ) ** 2 + (edge_coords[0][1] - u_xy[1]) ** 2
            end_dist = (edge_coords[-1][0] - u_xy[0]) ** 2 + \
                (edge_coords[-1][1] - u_xy[1]) ** 2
            if end_dist < start_dist:
                edge_coords.reverse()

            if not full_coords:
                full_coords.extend([[float(pt[0]), float(pt[1])]
                                   for pt in edge_coords])
            else:
                # Omit first point to avoid duplicate vertex
                full_coords.extend([[float(pt[0]), float(pt[1])]
                                   for pt in edge_coords[1:]])
        else:
            # Fallback to straight segment between nodes
            u_pt = [float(G.nodes[u]["x"]), float(G.nodes[u]["y"])]
            v_pt = [float(G.nodes[v]["x"]), float(G.nodes[v]["y"])]
            if not full_coords:
                full_coords.append(u_pt)
            full_coords.append(v_pt)

    avg_heat = round(weighted_heat_sum / total_distance_m,
                     3) if total_distance_m > 0 else 0.0
    avg_shade = round(weighted_shade_sum / total_distance_m,
                      3) if total_distance_m > 0 else 0.0
    avg_utci = round(utci_weighted_sum / utci_len_sum,
                     1) if utci_len_sum > 0 else None

    heat_source_label = (
        "UTCI-based thermal heat"
        if heat_source == "utci"
        else "Time-specific solar shadow exposure"
    )

    return RouteOption(
        type=objective,
        name="Fastest Route" if objective == "fastest" else "Cooler Route",
        geometry=GeoJSONLineString(type="LineString", coordinates=full_coords),
        stats=RouteStats(
            distance_m=round(total_distance_m, 1),
            duration_min=round(total_duration_sec / 60.0, 1),
            avg_heat_score=avg_heat,
            avg_utci_deg_c=avg_utci,
            avg_shade_fraction=avg_shade,
            heat_source=heat_source,
            heat_source_label=heat_source_label
        )
    )


def to_frontend_option(route: RouteOption, kind: str) -> FrontendRouteOption:
    stats = route.stats
    dist_m = max(1.0, float(stats.distance_m))
    score = float(
        round(max(0.0, min(1.0, float(stats.avg_heat_score))) * 100.0))
    dur_min = max(0.0, float(stats.duration_min))

    return FrontendRouteOption(
        id=kind,
        kind="fastest" if kind == "fastest" else "weighted",
        geometry=route.geometry.coordinates,
        segments=[
            FrontendRouteSegment(
                startDist=0.0,
                endDist=dist_m,
                score=score
            )
        ],
        summary=FrontendRouteSummary(
            distanceM=dist_m,
            durationMin=dur_min,
            avgHeatScore=score,
            avgShadeFraction=stats.avg_shade_fraction,
            avgUtciDegC=stats.avg_utci_deg_c,
            heatSource=stats.heat_source,
            heatSourceLabel=stats.heat_source_label
        )
    )


def calculate_routes(req: RouteRequest) -> RouteResponse:
    """
    Coordinates calculation for both Fastest and Cooler routes.
    """
    mode = req.mode
    try:
        G = graph_repo.get_graph(mode)
    except KeyError:
        raise HTTPException(
            status_code=503,
            detail=f"Network graph for mode '{
                mode}' is not loaded. Please ensure data files are generated."
        )

    # Snap start and end to network
    start_lon, start_lat = req.start[0], req.start[1]
    end_lon, end_lat = req.end[0], req.end[1]

    source_node, start_dist, (snapped_start_lon, snapped_start_lat) = graph_repo.find_nearest_node(
        mode, start_lon, start_lat)
    target_node, end_dist, (snapped_end_lon, snapped_end_lat) = graph_repo.find_nearest_node(
        mode, end_lon, end_lat)

    if start_dist > config.MAX_SNAP_DISTANCE_M:
        raise HTTPException(
            status_code=400,
            detail=f"Starting point is too far ({start_dist:.0f}m) from the campus network (max {
                config.MAX_SNAP_DISTANCE_M:.0f}m)."
        )
    if end_dist > config.MAX_SNAP_DISTANCE_M:
        raise HTTPException(
            status_code=400,
            detail=f"Destination point is too far ({end_dist:.0f}m) from the campus network (max {
                config.MAX_SNAP_DISTANCE_M:.0f}m)."
        )

    # Determine heat source and weight
    # A slider-driven request uses time-specific shadow exposure by default.
    # UTCI remains available when explicitly requested.
    heat_source = req.heat_source or ("shadow" if req.solar_time_minutes is not None else (
        "utci" if graph_repo.has_utci_data else "shadow"))

    if heat_source == "shadow" and req.solar_time_minutes is not None:
        # Copy the graph so simultaneous API requests cannot overwrite each
        # other's time-dependent edge attributes.
        G = G.copy()

        try:
            dynamic_metrics = calculate_edge_shadow_metrics(
                G, req.solar_time_minutes, req.trees,)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Dynamic shadow calculation failed: {exc}",
            )

        for (u, v, key), (shade_fraction, exposure_score) in dynamic_metrics.items():
            edge_data = G.edges[u, v, key]
            edge_data["avg_shade_fraction"] = shade_fraction
            edge_data["sun_exposure_score"] = exposure_score

    heat_weight = (req.heat_weight if req.heat_weight is not None and req.heat_weight >=
                   0 else config.DEFAULT_HEAT_WEIGHT)

    fastest_route = compute_single_route(
        G, source_node, target_node, "fastest", heat_weight, heat_source)
    cooler_route = compute_single_route(
        G, source_node, target_node, "cooler", heat_weight, heat_source)

    if heat_source == "utci":
        heat_desc = "Thermal comfort score derived from campus daytime UTCI raster (°C), normalized relative to campus conditions."
    else:
        heat_desc = (
            "Time-specific solar exposure calculated from campus building "
            "footprints and submitted tree positions for the selected local time."
        )

    frontend_fastest = to_frontend_option(fastest_route, "fastest")
    frontend_cooler = to_frontend_option(cooler_route, "weighted")

    return RouteResponse(
        routes=[frontend_fastest, frontend_cooler],
        mode=mode,
        fastest=fastest_route,
        cooler=cooler_route,
        heat_source=heat_source,
        heat_source_description=heat_desc,
        snapped_start=[snapped_start_lon, snapped_start_lat],
        snapped_end=[snapped_end_lon, snapped_end_lat]
    )
