import geopandas as gpd
import math
from shapely.affinity import translate
from datetime import datetime
import pytz
from astral import sun, Observer

def test_shadow_times():
    timezone = pytz.timezone('Asia/Kolkata')
    cuttack_observer = Observer(latitude=20.4625, longitude=85.8828)
    
    # Define a few test hours across the day
    test_hours = {
        "morning": datetime(2026, 5, 14, 8, 30, 0),
        "midday": datetime(2026, 5, 14, 12, 0, 0),
        "evening": datetime(2026, 5, 14, 16, 30, 0)
    }

    # Load static assets once
    buildings_gdf = gpd.read_file('buildings.geojson')
    edges_gdf = gpd.read_file('ravenshaw_edges.geojson')

    if edges_gdf.crs != "EPSG:32645":
        edges_gdf = edges_gdf.to_crs("EPSG:32645")
    if buildings_gdf.crs != "EPSG:32645":
        buildings_gdf = buildings_gdf.to_crs("EPSG:32645")

    for label, raw_time in test_hours.items():
        local_time = timezone.localize(raw_time)
        sun_elevation = sun.elevation(cuttack_observer, local_time)
        sun_azimuth = sun.azimuth(cuttack_observer, local_time)
        
        print(f"\n--- Testing {label.upper()} ({local_time.strftime('%H:%M')}) ---")
        print(f"Sun Elevation: {sun_elevation:.2f}° | Azimuth: {sun_azimuth:.2f}°")
        
        if sun_elevation <= 0:
            print("Sun below horizon, skipping.")
            continue

        shadow_polygons = []
        for idx, row in buildings_gdf.iterrows():
            building_height = row['DN']
            shadow_length = building_height / math.tan(math.radians(sun_elevation))
            shadow_angle = math.radians(sun_azimuth + 180)
            
            dx = shadow_length * math.sin(shadow_angle)
            dy = shadow_length * math.cos(shadow_angle)
            
            shifted_roof = translate(row['geometry'], xoff=dx, yoff=dy)
            full_shadow = row['geometry'].union(shifted_roof).convex_hull
            shadow_polygons.append({'geometry': full_shadow, 'shadow_source_id': idx})

        shadows_gdf = gpd.GeoDataFrame(shadow_polygons, crs="EPSG:32645")

        print(f"Slicing street geometries for {label}...")
        chopped_edges = gpd.overlay(edges_gdf, shadows_gdf, how='identity')
        chopped_edges['is_shaded'] = chopped_edges['shadow_source_id'].notna()
        
        if 'shadow_source_id' in chopped_edges.columns:
            chopped_edges = chopped_edges.drop(columns=['shadow_source_id'])

        output_filename = f"routed_edges_{label}.geojson"
        chopped_edges.to_file(output_filename, driver="GeoJSON")
        print(f"Saved {output_filename} with {len(chopped_edges)} segments.")

if __name__ == "__main__":
    test_shadow_times()