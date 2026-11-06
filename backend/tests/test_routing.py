import pytest
import networkx as nx
from fastapi import HTTPException
from pydantic import ValidationError
from backend.app.main import health_check, compute_route
from backend.app.graph_loader import graph_repo
from backend.app.routing import get_edge_fastest_cost, get_edge_cooler_cost, compute_single_route
from backend.app.models import RouteRequest

@pytest.fixture(scope="session", autouse=True)
def init_graphs():
    graph_repo.load_graphs()

def test_health_endpoint():
    res = health_check()
    assert res.status == "ready"
    assert res.walk_graph_loaded is True
    assert res.bike_graph_loaded is True
    assert "Ravenshaw University" in res.pilot_area

def test_cost_calculation_logic():
    edge_fast = {"travel_time_sec": 100.0, "utci_score": 0.2, "sun_exposure_score": 0.2}
    edge_hot = {"travel_time_sec": 100.0, "utci_score": 0.9, "sun_exposure_score": 0.9}

    # Fastest cost should depend only on travel time
    assert get_edge_fastest_cost(edge_fast) == 100.0
    assert get_edge_fastest_cost(edge_hot) == 100.0

    # Cooler cost should penalize the hotter edge
    cool_cost_fast = get_edge_cooler_cost(edge_fast, heat_weight=1.0, heat_source="utci")
    cool_cost_hot = get_edge_cooler_cost(edge_hot, heat_weight=1.0, heat_source="utci")

    assert cool_cost_fast == 100.0 * (1.0 + 1.0 * 0.2)  # 120.0
    assert cool_cost_hot == 100.0 * (1.0 + 1.0 * 0.9)   # 190.0
    assert cool_cost_hot > cool_cost_fast

def test_walking_route_success():
    req = RouteRequest(
        start=[85.8940, 20.4630],
        end=[85.8970, 20.4600],
        mode="walk"
    )
    res = compute_route(req)
    
    assert res.mode == "walk"
    assert res.fastest.geometry.type == "LineString"
    assert len(res.fastest.geometry.coordinates) >= 2
    assert res.cooler.geometry.type == "LineString"
    assert len(res.cooler.geometry.coordinates) >= 2

    fastest_stats = res.fastest.stats
    cooler_stats = res.cooler.stats
    assert fastest_stats.distance_m > 0
    assert fastest_stats.duration_min > 0
    assert 0.0 <= fastest_stats.avg_heat_score <= 1.0
    assert fastest_stats.duration_min <= cooler_stats.duration_min + 0.01

    # Verify frontend-compatible routes array format
    assert len(res.routes) == 2
    kinds = {r.kind for r in res.routes}
    assert "fastest" in kinds
    assert "weighted" in kinds
    for r in res.routes:
        assert len(r.geometry) >= 2
        assert len(r.segments) >= 1
        assert r.summary.distanceM > 0
        assert r.summary.durationMin >= 0
        for seg in r.segments:
            assert seg.startDist >= 0
            assert seg.endDist > seg.startDist
            assert 0 <= seg.score <= 100

def test_cycling_route_success():
    req_bike = RouteRequest(
        start=[85.8940, 20.4630],
        end=[85.8970, 20.4600],
        mode="bike"
    )
    res_bike = compute_route(req_bike)
    assert res_bike.mode == "bike"
    assert res_bike.fastest.stats.distance_m > 0

    req_walk = RouteRequest(
        start=[85.8940, 20.4630],
        end=[85.8970, 20.4600],
        mode="walk"
    )
    res_walk = compute_route(req_walk)
    # Bike duration should be faster than walk
    assert res_bike.fastest.stats.duration_min < res_walk.fastest.stats.duration_min

def test_alias_normalization():
    # Test origin/destination and profile alias normalization
    raw_payload = {
        "origin": [85.8940, 20.4630],
        "destination": [85.8970, 20.4600],
        "profile": "walking"
    }
    req = RouteRequest.model_validate(raw_payload)
    assert req.start == [85.8940, 20.4630]
    assert req.end == [85.8970, 20.4600]
    assert req.mode == "walk"

    res = compute_route(req)
    assert res.fastest.stats.distance_m > 0

def test_no_path_error_handling():
    # Construct a disconnected graph
    G_disconn = nx.MultiDiGraph()
    G_disconn.add_node(1, x=85.894, y=20.463)
    G_disconn.add_node(2, x=85.897, y=20.460)
    # No edges connecting node 1 and 2
    with pytest.raises(HTTPException) as exc_info:
        compute_single_route(G_disconn, source=1, target=2, objective="fastest", heat_weight=1.0, heat_source="shadow")
    assert exc_info.value.status_code == 404
    assert "No route found" in exc_info.value.detail

def test_out_of_bounds_error():
    req = RouteRequest(
        start=[77.2090, 28.6139], # New Delhi
        end=[85.8970, 20.4600],
        mode="walk"
    )
    with pytest.raises(HTTPException) as exc_info:
        compute_route(req)
    assert exc_info.value.status_code == 400
    assert "too far" in exc_info.value.detail.lower()

def test_invalid_coordinates_validation():
    with pytest.raises(ValidationError):
        RouteRequest(
            start=[999.0, 20.4630],
            end=[85.8970, 20.4600],
            mode="walk"
        )
