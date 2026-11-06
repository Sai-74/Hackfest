import os
import math
from datetime import datetime
import pytz
from astral import sun, Observer
import geopandas as gpd
import pandas as pd
import numpy as np
import rasterio
from shapely.affinity import translate
from shapely.ops import unary_union, transform
from shapely.validation import make_valid
import shapely.geometry
import shapely.wkt
import pyproj
import osmnx as ox

DEFAULT_LAT = 20.4631
DEFAULT_LON = 85.8938
TEST_DATE = datetime(2026, 5, 14)
TIMEZONE = pytz.timezone("Asia/Kolkata")

SAMPLE_TIMES = {
    "morning": (8, 30),
    "midday": (12, 0),
    "evening": (16, 30)
}


def compute_sun_positions(lat=DEFAULT_LAT, lon=DEFAULT_LON, date=TEST_DATE):
    obs = Observer(latitude=lat, longitude=lon)
    positions = {}
    for label, (h, m) in SAMPLE_TIMES.items():
        dt = TIMEZONE.localize(
            datetime(date.year, date.month, date.day, h, m, 0))
        elev = sun.elevation(obs, dt)
        az = sun.azimuth(obs, dt)
        positions[label] = {
            "elevation": elev,
            "azimuth": az,
            "datetime": dt
        }
        print(f"Sun for {label} ({dt.strftime('%H:%M')}): elevation={
              elev:.2f}°, azimuth={az:.2f}°", flush=True)
    return positions


def generate_shadow_unions(buildings_gdf, sun_positions, clip_box_32645=None):
    """
    Computes building shadows for each sample time and unifies overlapping shadows.
    """
    if buildings_gdf.crs != "EPSG:32645":
        buildings_gdf = buildings_gdf.to_crs("EPSG:32645")

    shadow_unions = {}
    total_buildings = len(buildings_gdf)
    print(f"Generating shadows for {total_buildings} buildings...", flush=True)

    for label, pos in sun_positions.items():
        elev = pos["elevation"]
        az = pos["azimuth"]
        if elev <= 0:
            print(f"Sun below horizon for {label}, skipping.", flush=True)
            shadow_unions[label] = shapely.geometry.GeometryCollection()
            continue

        tan_elev = math.tan(math.radians(elev))
        shadow_angle = math.radians(az + 180)
        sin_ang = math.sin(shadow_angle)
        cos_ang = math.cos(shadow_angle)

        shadow_polygons = []
        for _, row in buildings_gdf.iterrows():
            geom = row.geometry
            if geom is None or geom.is_empty:
                continue

            # Height verification from verified 'DN' attribute
            height = row.get("DN")
            if height is None or pd.isna(height) or height <= 0:
                continue

            if not geom.is_valid:
                geom = make_valid(geom)

            shadow_len = float(height) / tan_elev
            dx = shadow_len * sin_ang
            dy = shadow_len * cos_ang

            shifted_roof = translate(geom, xoff=dx, yoff=dy)
            full_shadow = geom.union(shifted_roof).convex_hull
            if clip_box_32645 is not None:
                full_shadow = full_shadow.intersection(clip_box_32645)
            if not full_shadow.is_empty:
                shadow_polygons.append(full_shadow)

        print(f"Dissolving {len(shadow_polygons)
                            } individual shadows for {label}...", flush=True)
        # Dissolve / union overlapping shadows
        shadow_union = unary_union(shadow_polygons)
        shadow_unions[label] = shadow_union
        print(f"Shadow union created for {label}.", flush=True)

    return shadow_unions


def sample_utci_along_geom(geom_32645, utci_src, utci_band, sample_dist_m=5.0):
    """
    Samples UTCI raster values along a LineString in EPSG:32645.
    """
    length = geom_32645.length
    if length <= 0:
        return None

    # Number of sample points
    num_samples = max(2, int(math.ceil(length / sample_dist_m)) + 1)
    dists = np.linspace(0, length, num_samples)
    values = []

    for d in dists:
        pt = geom_32645.interpolate(d)
        row, col = utci_src.index(pt.x, pt.y)
        if 0 <= row < utci_src.height and 0 <= col < utci_src.width:
            val = utci_band[row, col]
            if not np.isnan(val) and val != utci_src.nodata:
                values.append(float(val))

    if len(values) > 0:
        return float(np.mean(values))
    return None


def process_and_enrich_graphs():
    data_dir = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "data"))
    buildings_path = os.path.join(data_dir, "buildings.geojson")
    utci_path = os.path.join(data_dir, "utci_day_mean.tif")

    print(f"Loading buildings from {buildings_path}...", flush=True)
    buildings_gdf = gpd.read_file(buildings_path)

    # Metric bounding box (EPSG:32645) with 150m buffer
    minx, miny, maxx, maxy = buildings_gdf.total_bounds
    clip_box = shapely.geometry.box(
        minx - 150, miny - 150, maxx + 150, maxy + 150)

    # Compute sun positions and shadow unions
    sun_positions = compute_sun_positions()
    shadow_unions = generate_shadow_unions(
        buildings_gdf, sun_positions, clip_box)

    # Open UTCI raster if valid
    utci_src = None
    utci_band = None
    if os.path.exists(utci_path):
        try:
            utci_src = rasterio.open(utci_path)
            utci_band = utci_src.read(1)
            print(f"Loaded UTCI raster from {utci_path}, CRS: {
                  utci_src.crs}, shape: {utci_band.shape}", flush=True)
        except Exception as e:
            print(f"Failed to open UTCI raster: {e}", flush=True)

    transformer_4326_to_32645 = pyproj.Transformer.from_crs(
        "EPSG:4326", "EPSG:32645", always_xy=True).transform

    for mode in ["walk", "bike"]:
        graphml_path = os.path.join(data_dir, f"ravenshaw_{mode}.graphml")
        if not os.path.exists(graphml_path):
            print(
                f"GraphML {graphml_path} does not exist, skipping.", flush=True)
            continue

        print(f"\n--- Enriching {mode} graph ({graphml_path}) ---", flush=True)
        G = ox.load_graphml(graphml_path)

        edge_utci_values = []

        # Iterate through edges
        for u, v, k, data in G.edges(keys=True, data=True):
            # Extract edge geometry in 4326
            if "geometry" in data and isinstance(data["geometry"], shapely.geometry.base.BaseGeometry):
                geom_4326 = data["geometry"]
            elif "geometry" in data and isinstance(data["geometry"], str):
                geom_4326 = shapely.wkt.loads(data["geometry"])
            else:
                # Build LineString from node coordinates
                u_node = G.nodes[u]
                v_node = G.nodes[v]
                geom_4326 = shapely.geometry.LineString(
                    [(u_node["x"], u_node["y"]), (v_node["x"], v_node["y"])])

            # Reproject to metric EPSG:32645
            geom_32645 = transform(transformer_4326_to_32645, geom_4326)
            total_len = geom_32645.length
            # If length attribute is missing or 0, use geometric length
            if "length" not in data or float(data["length"]) <= 0:
                data["length"] = total_len

            # Shade calculations
            if total_len > 0:
                m_shade = geom_32645.intersection(
                    shadow_unions["morning"]).length
                d_shade = geom_32645.intersection(
                    shadow_unions["midday"]).length
                e_shade = geom_32645.intersection(
                    shadow_unions["evening"]).length

                frac_m = min(1.0, max(0.0, m_shade / total_len))
                frac_d = min(1.0, max(0.0, d_shade / total_len))
                frac_e = min(1.0, max(0.0, e_shade / total_len))
            else:
                frac_m = frac_d = frac_e = 0.0

            avg_shade = (frac_m + frac_d + frac_e) / 3.0
            sun_exp = round(max(0.0, min(1.0, 1.0 - avg_shade)), 4)

            data["shade_fraction_morning"] = round(frac_m, 4)
            data["shade_fraction_midday"] = round(frac_d, 4)
            data["shade_fraction_evening"] = round(frac_e, 4)
            data["avg_shade_fraction"] = round(avg_shade, 4)
            data["sun_exposure_score"] = sun_exp

            # UTCI sampling
            if utci_src is not None:
                mean_utci = sample_utci_along_geom(
                    geom_32645, utci_src, utci_band)
                if mean_utci is not None:
                    data["utci_deg_c"] = round(mean_utci, 2)
                    edge_utci_values.append(mean_utci)
                else:
                    data["utci_deg_c"] = None
            else:
                data["utci_deg_c"] = None

        # Normalize UTCI scores if available
        if len(edge_utci_values) > 0:
            min_utci = min(edge_utci_values)
            max_utci = max(edge_utci_values)
            print(f"UTCI stats for {mode}: min={min_utci:.2f}°C, max={
                  max_utci:.2f}°C, mean={np.mean(edge_utci_values):.2f}°C", flush=True)
            for u, v, k, data in G.edges(keys=True, data=True):
                val = data.get("utci_deg_c")
                if val is not None and max_utci > min_utci:
                    data["utci_score"] = round(
                        max(0.0, min(1.0, (val - min_utci) / (max_utci - min_utci))), 4)
                elif val is not None:
                    data["utci_score"] = 0.5
                else:
                    # Fallback to sun_exposure_score if UTCI point is missing
                    data["utci_score"] = data["sun_exposure_score"]
        else:
            for u, v, k, data in G.edges(keys=True, data=True):
                data["utci_score"] = data["sun_exposure_score"]

        # Save enriched GraphML
        ox.save_graphml(G, graphml_path)
        print(f"Saved enriched GraphML: {graphml_path}", flush=True)

        # Export enriched GeoJSON
        nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)
        if "u" not in edges_gdf.columns:
            edges_gdf = edges_gdf.reset_index()

        nodes_geojson = os.path.join(
            data_dir, f"ravenshaw_{mode}_nodes.geojson")
        edges_geojson = os.path.join(
            data_dir, f"ravenshaw_{mode}_edges.geojson")
        nodes_gdf.to_file(nodes_geojson, driver="GeoJSON")
        edges_gdf.to_file(edges_geojson, driver="GeoJSON")
        print(f"Saved enriched GeoJSON: {
              edges_geojson} ({len(edges_gdf)} edges)", flush=True)

    if utci_src is not None:
        utci_src.close()

    print("All edge heat and shade calculations completed successfully!", flush=True)


if __name__ == "__main__":
    process_and_enrich_graphs()
