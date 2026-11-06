import os
import json
import geopandas as gpd
import rasterio
import numpy as np

def inspect():
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    print(f"Inspecting files in: {os.path.abspath(data_dir)}")

    rasters = ["ravenshaw_building_dsm.tif", "utci_day_mean.tif", "tmrt_day_mean.tif"]
    for r_name in rasters:
        r_path = os.path.join(data_dir, r_name)
        if not os.path.exists(r_path):
            print(f"Raster {r_name} not found!")
            continue
        with rasterio.open(r_path) as src:
            data = src.read(1)
            valid_mask = data != src.nodata if src.nodata is not None else ~np.isnan(data)
            valid_data = data[valid_mask] if np.any(valid_mask) else np.array([])
            print(f"\n--- Raster: {r_name} ---")
            print(f"  CRS: {src.crs}")
            print(f"  Bounds: {src.bounds}")
            print(f"  Shape: {src.shape}, Resolution: {src.res}")
            print(f"  NoData: {src.nodata}")
            if len(valid_data) > 0:
                print(f"  Min: {valid_data.min():.2f}, Max: {valid_data.max():.2f}, Mean: {valid_data.mean():.2f}, Count: {len(valid_data)}")
            else:
                print("  No valid data points found")

    vectors = ["buildings.geojson", "ravenshaw_edges.geojson", "ravenshaw_nodes.geojson"]
    for v_name in vectors:
        v_path = os.path.join(data_dir, v_name)
        if not os.path.exists(v_path):
            print(f"Vector {v_name} not found!")
            continue
        gdf = gpd.read_file(v_path)
        print(f"\n--- Vector: {v_name} ---")
        print(f"  CRS: {gdf.crs}")
        print(f"  Count: {len(gdf)}")
        print(f"  Total Bounds: {gdf.total_bounds}")
        print(f"  Columns: {list(gdf.columns)}")
        if v_name == "buildings.geojson" and "DN" in gdf.columns:
            dn_vals = gdf["DN"]
            print(f"  DN min: {dn_vals.min()}, max: {dn_vals.max()}, mean: {dn_vals.mean():.2f}")
            print(f"  DN head: {dn_vals.head(5).tolist()}")
        if v_name == "ravenshaw_edges.geojson":
            print(f"  Sample row:\n{gdf.head(1).T}")

    # Compare DN in buildings with ravenshaw_building_dsm.tif
    bldg_path = os.path.join(data_dir, "buildings.geojson")
    dsm_path = os.path.join(data_dir, "ravenshaw_building_dsm.tif")
    if os.path.exists(bldg_path) and os.path.exists(dsm_path):
        bldg_gdf = gpd.read_file(bldg_path)
        with rasterio.open(dsm_path) as src:
            if bldg_gdf.crs != src.crs:
                bldg_gdf = bldg_gdf.to_crs(src.crs)
            sample_comparisons = []
            for idx, row in bldg_gdf.head(10).iterrows():
                centroid = row.geometry.centroid
                py, px = src.index(centroid.x, centroid.y)
                if 0 <= py < src.height and 0 <= px < src.width:
                    val = src.read(1)[py, px]
                    sample_comparisons.append((row.get("DN"), float(val)))
            print("\n--- DN vs DSM at Centroid (first 10 buildings) ---")
            for dn, dsm_val in sample_comparisons:
                print(f"  DN: {dn} vs DSM: {dsm_val:.2f}")

if __name__ == "__main__":
    inspect()

