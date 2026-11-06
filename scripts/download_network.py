import os
import requests
import pyproj
import shapely.geometry
import osmnx as ox

def get_study_polygon():
    # DSM bounds in EPSG:32645:
    # left=384420.0, bottom=2262804.0, right=385096.0, top=2263508.0
    buffer_m = 100.0
    minx = 384420.0 - buffer_m
    miny = 2262804.0 - buffer_m
    maxx = 385096.0 + buffer_m
    maxy = 2263508.0 + buffer_m

    box_32645 = shapely.geometry.box(minx, miny, maxx, maxy)
    
    # Project to EPSG:4326
    proj_32645_to_4326 = pyproj.Transformer.from_crs("EPSG:32645", "EPSG:4326", always_xy=True).transform
    polygon_4326 = shapely.ops.transform(proj_32645_to_4326, box_32645)
    return polygon_4326

def fetch_osm_xml_fallback(polygon_4326, dest_path):
    min_lon, min_lat, max_lon, max_lat = polygon_4326.bounds
    url = f"https://api.openstreetmap.org/api/0.6/map?bbox={min_lon:.5f},{min_lat:.5f},{max_lon:.5f},{max_lat:.5f}"
    headers = {"User-Agent": "CoolRoute-Campus-Pilot/1.0 (hackfest@pilot.edu)"}
    print(f"Fallback: Fetching raw OSM data from official OSM API: {url}", flush=True)
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        f.write(r.content)
    print(f"Saved OSM XML to {dest_path} ({len(r.content)} bytes)", flush=True)

def download_and_save():
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(data_dir, exist_ok=True)

    polygon_4326 = get_study_polygon()
    print(f"Study area bounds (EPSG:4326): {polygon_4326.bounds}", flush=True)

    ox.settings.overpass_url = "https://lz4.overpass-api.de/api"
    ox.settings.requests_timeout = 300
    ox.settings.use_cache = True
    ox.settings.user_agent = "CoolRoute-Campus-Pilot/1.0 (hackfest@pilot.edu)"

    modes = [("walk", "ravenshaw_walk"), ("bike", "ravenshaw_bike")]
    
    # Check if Overpass is healthy with a quick timeout test
    overpass_works = False
    try:
        ox.settings.requests_timeout = 10
        print("Testing Overpass API endpoint...", flush=True)
        test_g = ox.graph_from_polygon(polygon_4326, network_type="walk", retain_all=True)
        if len(test_g.nodes) > 0:
            overpass_works = True
            print("Overpass API is accessible and working!", flush=True)
    except Exception as e:
        print(f"Primary Overpass URL failed ({e}), trying default Overpass URL...", flush=True)
        try:
            ox.settings.overpass_url = "https://overpass-api.de/api"
            test_g = ox.graph_from_polygon(polygon_4326, network_type="walk", retain_all=True)
            if len(test_g.nodes) > 0:
                overpass_works = True
                print("Default Overpass API is accessible!", flush=True)
        except Exception as e2:
            print(f"Default Overpass also failed ({e2}).", flush=True)

    # If Overpass is not working, use the official OSM API bbox fallback
    xml_path = os.path.join(data_dir, "ravenshaw_campus.osm")
    if not overpass_works and not os.path.exists(xml_path):
        fetch_osm_xml_fallback(polygon_4326, xml_path)

    for mode, base_name in modes:
        print(f"\n--- Generating graph for mode: {mode} ---", flush=True)
        graph = None
        if overpass_works:
            try:
                ox.settings.requests_timeout = 300
                graph = ox.graph_from_polygon(polygon_4326, network_type=mode, retain_all=True)
            except Exception as e:
                print(f"Overpass download for {mode} failed: {e}", flush=True)

        if graph is None and os.path.exists(xml_path):
            print(f"Building {mode} graph from OSM XML {xml_path}...", flush=True)
            # Load from OSM XML
            raw_g = ox.graph_from_xml(xml_path)
            # Filter graph based on mode
            graph = raw_g.copy()
            # Remove edges not allowed for bike if mode == 'bike'
            if mode == "bike":
                edges_to_remove = []
                for u, v, k, d in graph.edges(keys=True, data=True):
                    h = d.get("highway")
                    b = d.get("bicycle")
                    if b == "no" or h in ["steps", "footway", "pedestrian"]:
                        edges_to_remove.append((u, v, k))
                for edge in edges_to_remove:
                    graph.remove_edge(*edge)
            
            # Ensure lengths are added
            graph = ox.distance.add_edge_lengths(graph)

        if graph is None:
            raise RuntimeError(f"Could not build or download network for mode {mode}!")

        # Save GraphML
        graphml_path = os.path.join(data_dir, f"{base_name}.graphml")
        ox.save_graphml(graph, graphml_path)
        print(f"Saved GraphML: {graphml_path} ({len(graph.nodes)} nodes, {len(graph.edges)} edges)", flush=True)

        # Export GeoJSON
        nodes_gdf, edges_gdf = ox.graph_to_gdfs(graph)
        if 'u' not in edges_gdf.columns:
            edges_gdf = edges_gdf.reset_index()

        nodes_geojson_path = os.path.join(data_dir, f"{base_name}_nodes.geojson")
        edges_geojson_path = os.path.join(data_dir, f"{base_name}_edges.geojson")

        nodes_gdf.to_file(nodes_geojson_path, driver="GeoJSON")
        edges_gdf.to_file(edges_geojson_path, driver="GeoJSON")
        print(f"Saved {nodes_geojson_path}")
        print(f"Saved {edges_geojson_path}")

if __name__ == "__main__":
    download_and_save()
