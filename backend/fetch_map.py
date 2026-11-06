import osmnx as ox
import matplotlib.pyplot as plt
import os

# --- CONFIGURATION ---
CAMPUS_LOCATION = "Ravenshaw University, Cuttack, Odisha, India"

# GPS Coordinates for Ravenshaw University (just in case the name search fails)
LATITUDE = 20.4650
LONGITUDE = 85.8830

print(f"1. Downloading walking network for: {CAMPUS_LOCATION}...")
print("(This might take a minute, please wait...)")

# --- FETCH THE MAP ---
try:
    # Try to get the map using the name
    G = ox.graph_from_place(CAMPUS_LOCATION, network_type='walk', simplify=True)
    print(f"2. Success! Downloaded {len(G.nodes)} intersections (nodes) and {len(G.edges)} paths (edges).")
except Exception as e:
    # If the name fails, fallback to GPS coordinates (500 meter radius)
    print(f"Name search failed ({e}). Switching to GPS coordinates...")
    G = ox.graph_from_point((LATITUDE, LONGITUDE), dist=500, network_type='walk', simplify=True)
    print(f"Fallback Success! Downloaded {len(G.nodes)} nodes and {len(G.edges)} edges.")

# --- SAVE THE DATA ---
# Create a 'data' folder if it doesn't exist
os.makedirs("data", exist_ok=True)

# Save as GraphML for later use in our algorithm
ox.save_graphml(G, filepath="data/campus_base_graph.graphml")
print("3. Saved the raw map data to 'data/campus_base_graph.graphml'")

# --- VISUALIZE THE MAP ---
print("4. Generating a visual map...")
fig, ax = ox.plot_graph(G, node_size=10, node_color='red', edge_color='gray', bgcolor='white', show=False, close=False)
plt.title(f"Walking Network: {CAMPUS_LOCATION}")

# Save the image
plt.savefig("data/campus_base_map.png", dpi=300)
print("5. Saved map image to 'data/campus_base_map.png'")

# Show the plot on your screen
plt.show()
print("Done! Check the popup window for your map.")