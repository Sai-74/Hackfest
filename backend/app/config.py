import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_DIR = os.path.join(BASE_DIR, "data")

WALK_GRAPHML_PATH = os.path.join(DATA_DIR, "ravenshaw_walk.graphml")
BIKE_GRAPHML_PATH = os.path.join(DATA_DIR, "ravenshaw_bike.graphml")
BUILDINGS_PATH = os.path.join(DATA_DIR, "buildings.geojson")
UTCI_RASTER_PATH = os.path.join(DATA_DIR, "utci_day_mean.tif")

# Campus reference point (Ravenshaw University main campus)
DEFAULT_CENTER_LAT = 20.4631
DEFAULT_CENTER_LON = 85.8938

# Speeds in meters per second
SPEED_WALK_MPS = float(os.getenv("COOLROUTE_SPEED_WALK", "1.4"))
SPEED_BIKE_MPS = float(os.getenv("COOLROUTE_SPEED_BIKE", "4.2"))

# Heat weight in cool_cost = time_sec * (1 + heat_weight * heat_score)
DEFAULT_HEAT_WEIGHT = float(os.getenv("COOLROUTE_HEAT_WEIGHT", "1.0"))

# Primary heat source: "utci" if valid raster exists, else "shadow"
DEFAULT_HEAT_SOURCE = os.getenv("COOLROUTE_HEAT_SOURCE", "utci")

# Max allowable snapping distance from campus network in meters
MAX_SNAP_DISTANCE_M = 1500.0

