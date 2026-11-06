"""
CoolRoute — Edge Heat and Shadow Preprocessor.

Enriches Ravenshaw University pedestrian and cycling network graphs with:
1. Building shade fractions (morning, midday, evening).
2. Sampled daytime mean UTCI (°C) along street segments.
3. Normalized heat scores for thermal-aware Dijkstra routing.
"""
import os
import math
from datetime import datetime
import pytz
from astral import sun, Observer
import geopandas as gpd
import numpy as np
import rasterio
from shapely.affinity import translate
from shapely.ops import unary_union, transform
import shapely.geometry
import shapely.wkt
import pyproj
import osmnx as ox

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
TIMEZONE = pytz.timezone("Asia/Kolkata")
SAMPLE_HOURS = {"morning": (8, 30), "midday": (12, 0), "evening": (16, 30)}
DATE = datetime(2026, 5, 14)
CAMPUS_LAT, CAMPUS_LON = 20.4631, 85.8938


def get_solar_positions():
    """Computes solar elevation and azimuth for morning, midday, and evening."""
    obs = Observer(latitude=CAMPUS_LAT, longitude=CAMPUS_LON)
    positions = {}
    for name, (h, m) in SAMPLE_HOURS.items():
        dt = TIMEZONE.localize(datetime(DATE.year, DATE.month, DATE.day, h, m))
        positions[name] = (sun.elevation(obs, dt), sun.azimuth(obs, dt))
    return positions


def build_shadow_unions(buildings_gdf, sun_pos):
    """Generates dissolved shadow polygons in EPSG:32645 for each time of day."""
    if buildings_gdf.crs != "EPSG:32645":
        buildings_gdf = buildings_gdf.to_crs("EPSG:32645")

    shadows = {}
    for name, (elev, az) in sun_pos.items():
        if elev <= 0:
            shadows[name] = shapely.geometry.GeometryCollection()
            continue

        tan_elev = math.tan(math.radians(elev))
        angle = math.radians(az + 180)
        sin_a, cos_a = math.sin(angle), math.cos(angle)

        polys = []
        for _, row in buildings_gdf.iterrows():
            geom, height = row.geometry, row.get("DN")
            if geom and not geom.is_empty and height and float(height) > 0:
                dist = float(height) / tan_elev
                shifted = translate(geom, xoff=dist * sin_a, yoff=dist * cos_a)
                polys.append(geom.union(shifted).convex_hull)

        shadows[name] = unary_union(polys)
    return shadows


def sample_utci(geom, src, band, step=5.0):
    """Samples mean UTCI raster value along an edge in EPSG:32645."""
    if not src or geom.length <= 0:
        return None
    pts = [geom.interpolate(d) for d in np.linspace(0, geom.length, max(2, int(geom.length / step) + 1))]
    vals = [
        band[r, c] for pt in pts for r, c in [src.index(pt.x, pt.y)]
        if 0 <= r < src.height and 0 <= c < src.width and band[r, c] != src.nodata and not np.isnan(band[r, c])
    ]
    return float(np.mean(vals)) if vals else None


def enrich_graph(G, shadows, utci_src, utci_band, to_32645):
    """Calculates shade fractions, UTCI, and normalized heat scores on graph edges."""
    utci_values = []
    for u, v, k, data in G.edges(keys=True, data=True):
        geom = data.get("geometry")
        if isinstance(geom, str):
            geom = shapely.wkt.loads(geom)
        elif not isinstance(geom, shapely.geometry.base.BaseGeometry):
            geom = shapely.geometry.LineString([(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])])

        geom_m = transform(to_32645, geom)
        length = geom_m.length
        if "length" not in data or float(data["length"]) <= 0:
            data["length"] = length

        # Shade fraction per sample time and average
        shades = {t: min(1.0, geom_m.intersection(shadows[t]).length / length) if length > 0 else 0.0 for t in SAMPLE_HOURS}
        avg_shade = sum(shades.values()) / 3.0
        data.update({
            "shade_fraction_morning": round(shades["morning"], 4),
            "shade_fraction_midday": round(shades["midday"], 4),
            "shade_fraction_evening": round(shades["evening"], 4),
            "avg_shade_fraction": round(avg_shade, 4),
            "sun_exposure_score": round(max(0.0, 1.0 - avg_shade), 4),
        })

        # Sample UTCI raster
        val = sample_utci(geom_m, utci_src, utci_band)
        data["utci_deg_c"] = round(val, 2) if val is not None else None
        if val is not None:
            utci_values.append(val)

    # Normalize UTCI score or fallback to sun exposure
    min_u, max_u = (min(utci_values), max(utci_values)) if utci_values else (None, None)
    for _, _, _, data in G.edges(keys=True, data=True):
        val = data.get("utci_deg_c")
        if val is not None and max_u and max_u > min_u:
            data["utci_score"] = round((val - min_u) / (max_u - min_u), 4)
        elif val is not None:
            data["utci_score"] = 0.5
        else:
            data["utci_score"] = data["sun_exposure_score"]


def process_and_enrich_graphs():
    """Main pipeline: computes shadows, samples heat, and saves enriched graphs."""
    b_path = os.path.join(DATA_DIR, "buildings.geojson")
    u_path = os.path.join(DATA_DIR, "utci_day_mean.tif")
    to_32645 = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32645", always_xy=True).transform

    print("[CoolRoute Preprocessor] Computing solar positions and building shadows...", flush=True)
    buildings_gdf = gpd.read_file(b_path)
    shadows = build_shadow_unions(buildings_gdf, get_solar_positions())

    utci_src, utci_band = None, None
    if os.path.exists(u_path):
        utci_src = rasterio.open(u_path)
        utci_band = utci_src.read(1)
        print(f"[CoolRoute Preprocessor] Loaded UTCI raster: {utci_band.shape}", flush=True)

    for mode in ["walk", "bike"]:
        g_path = os.path.join(DATA_DIR, f"ravenshaw_{mode}.graphml")
        if not os.path.exists(g_path):
            continue
        print(f"[CoolRoute Preprocessor] Enriching {mode} network...", flush=True)
        G = ox.load_graphml(g_path)
        enrich_graph(G, shadows, utci_src, utci_band, to_32645)
        ox.save_graphml(G, g_path)

        # Export enriched GeoJSON for visualization and inspection
        nodes_gdf, edges_gdf = ox.graph_to_gdfs(G)
        if "u" not in edges_gdf.columns:
            edges_gdf = edges_gdf.reset_index()
        nodes_gdf.to_file(os.path.join(DATA_DIR, f"ravenshaw_{mode}_nodes.geojson"), driver="GeoJSON")
        edges_gdf.to_file(os.path.join(DATA_DIR, f"ravenshaw_{mode}_edges.geojson"), driver="GeoJSON")
        print(f"[CoolRoute Preprocessor] Saved {mode} GraphML and GeoJSON.", flush=True)

    if utci_src:
        utci_src.close()
    print("[CoolRoute Preprocessor] All edge heat and shade calculations completed.", flush=True)


if __name__ == "__main__":
    process_and_enrich_graphs()
