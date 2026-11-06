import logging
import math
import os
from datetime import date, datetime, time, timedelta
from functools import lru_cache
from typing import Dict, Tuple
from zoneinfo import ZoneInfo

import geopandas as gpd
import networkx as nx
import pyproj
from astral import Observer
from astral.sun import azimuth, elevation
from shapely.affinity import translate
from shapely.geometry import GeometryCollection, LineString, Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from . import config
from .models import TreeShadowInput

logger = logging.getLogger(__name__)

CAMPUS_LATITUDE = 20.462886
CAMPUS_LONGITUDE = 85.895947
MAX_SHADOW_LENGTH_M = 60.0
LOCAL_TZ = ZoneInfo("Asia/Kolkata")

OBSERVER = Observer(
    latitude=CAMPUS_LATITUDE,
    longitude=CAMPUS_LONGITUDE,
)

TO_UTM = pyproj.Transformer.from_crs(
    "EPSG:4326",
    "EPSG:32645",
    always_xy=True,
).transform


def _load_buildings() -> Tuple[Tuple[BaseGeometry, float], ...]:
    """Load and project building footprints once."""
    if not os.path.exists(config.BUILDINGS_PATH):
        logger.warning("Building footprint file not found: %s",
                       config.BUILDINGS_PATH)
        return ()

    frame = gpd.read_file(config.BUILDINGS_PATH)

    if frame.empty:
        return ()

    if frame.crs is None:
        bounds = frame.total_bounds
        # The source file is normally EPSG:32645. Detect unlabelled coordinates.
        if max(abs(bounds[0]), abs(bounds[2])) > 180:
            frame = frame.set_crs("EPSG:32645")
        else:
            frame = frame.set_crs("EPSG:4326")

    frame = frame.to_crs("EPSG:32645")

    buildings = []

    for _, row in frame.iterrows():
        geometry = row.geometry

        if geometry is None or geometry.is_empty:
            continue

        if not geometry.is_valid:
            geometry = geometry.buffer(0)

        if geometry.is_empty:
            continue

        raw_height = row.get("DN", row.get("height_m", 4.0))

        try:
            height = float(raw_height)
        except (TypeError, ValueError):
            height = 4.0

        if not math.isfinite(height) or height <= 0:
            height = 4.0

        buildings.append((geometry, min(height, 21.0)))

    logger.info("Loaded %d building footprints for solar shadows",
                len(buildings))
    return tuple(buildings)


@lru_cache(maxsize=1)
def _building_footprints() -> Tuple[Tuple[BaseGeometry, float], ...]:
    return _load_buildings()


def _solar_position(
    selected_date: date,
    time_minutes: int,
) -> Tuple[float, float]:
    selected_datetime = (
        datetime.combine(selected_date, time.min, tzinfo=LOCAL_TZ)
        + timedelta(minutes=time_minutes)
    )

    sun_elevation = float(elevation(OBSERVER, selected_datetime))
    sun_azimuth = float(azimuth(OBSERVER, selected_datetime))

    return sun_azimuth, sun_elevation


def _shadow_displacement(
    height_m: float,
    sun_azimuth: float,
    sun_elevation: float,
) -> Tuple[float, float]:
    elevation_rad = math.radians(sun_elevation)
    length = min(
        MAX_SHADOW_LENGTH_M,
        height_m / math.tan(elevation_rad),
    )

    # Shadows extend in the direction opposite to the sun.
    shadow_azimuth = math.radians((sun_azimuth + 180.0) % 360.0)

    east = math.sin(shadow_azimuth) * length
    north = math.cos(shadow_azimuth) * length

    return east, north


@lru_cache(maxsize=96)
def _building_shadow_union(
    date_key: str,
    time_minutes: int,
) -> Tuple[BaseGeometry, bool]:
    """Cache building shadow geometry for each selected local time."""
    selected_date = date.fromisoformat(date_key)
    sun_azimuth, sun_elevation = _solar_position(
        selected_date,
        time_minutes,
    )

    if sun_elevation <= 2.5:
        return GeometryCollection(), False

    shadows = []

    for footprint, height in _building_footprints():
        east, north = _shadow_displacement(
            height,
            sun_azimuth,
            sun_elevation,
        )

        shifted = translate(footprint, xoff=east, yoff=north)
        shadow = footprint.union(shifted).convex_hull

        if not shadow.is_empty:
            shadows.append(shadow)

    if not shadows:
        return GeometryCollection(), True

    return unary_union(shadows), True


def _tree_shadow(
    tree: TreeShadowInput,
    sun_azimuth: float,
    sun_elevation: float,
) -> BaseGeometry:
    lon, lat = tree.position
    x, y = TO_UTM(lon, lat)

    east, north = _shadow_displacement(
        tree.height_m,
        sun_azimuth,
        sun_elevation,
    )

    shadow_axis = LineString([
        (x, y),
        (x + east, y + north),
    ])

    return shadow_axis.buffer(tree.shade_radius_m)


def calculate_edge_shadow_metrics(
    graph: nx.MultiDiGraph,
    time_minutes: int,
    trees: list[TreeShadowInput],
) -> Dict[Tuple[int, int, int], Tuple[float, float]]:
    """
    Return (shade_fraction, sun_exposure_score) for each directed graph edge.
    Both values are normalized to [0, 1].
    """
    selected_date = datetime.now(LOCAL_TZ).date()
    date_key = selected_date.isoformat()

    building_shadows, sun_is_up = _building_shadow_union(
        date_key,
        time_minutes,
    )

    # There is no direct solar exposure when the sun is below the horizon.
    if not sun_is_up:
        return {
            (u, v, key): (0.0, 0.0)
            for u, v, key in graph.edges(keys=True)
        }

    sun_azimuth, sun_elevation = _solar_position(
        selected_date,
        time_minutes,
    )

    shadow_parts = []

    if not building_shadows.is_empty:
        shadow_parts.append(building_shadows)

    for tree in trees:
        shadow = _tree_shadow(tree, sun_azimuth, sun_elevation)
        if not shadow.is_empty:
            shadow_parts.append(shadow)

    combined_shadows = (
        unary_union(shadow_parts)
        if shadow_parts
        else GeometryCollection()
    )

    metrics: Dict[Tuple[int, int, int], Tuple[float, float]] = {}

    for u, v, key, data in graph.edges(keys=True, data=True):
        geometry = data.get("geometry")

        if geometry is None or geometry.is_empty:
            metrics[(u, v, key)] = (0.0, 1.0)
            continue

        edge_metric = transform(TO_UTM, geometry)
        edge_length = edge_metric.length

        if edge_length <= 0 or combined_shadows.is_empty:
            shade_fraction = 0.0
        else:
            shaded_length = edge_metric.intersection(combined_shadows).length
            shade_fraction = max(
                0.0,
                min(1.0, shaded_length / edge_length),
            )

        exposure_score = 1.0 - shade_fraction

        metrics[(u, v, key)] = (
            shade_fraction,
            exposure_score,
        )

    return metrics
