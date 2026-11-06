# CoolRoute — Heat-Aware Campus Router (Ravenshaw University Pilot)

CoolRoute is a mobile-friendly, thermal-aware walking route navigation application built for the **Ravenshaw University main campus pilot in Cuttack, Odisha, India**.

It enables campus pedestrians to calculate and compare:
1. **Fastest Route** — minimizes estimated walking travel time.
2. **Cooler Route** — balances travel time against heat and solar exposure using 3D building shadow simulations and calibrated daytime UTCI (Universal Thermal Climate Index) rasters.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + MapLibre GL + Tailwind CSS.
  - Interactive map centered on Ravenshaw University main campus.
  - **Real-Time Sun Positioning**: Dynamic solar elevation and azimuth modeling for campus coordinates ($20.462886^\circ\text{ N}, 85.895947^\circ\text{ E}$).
  - **Interactive Time-of-Day Slider**: 24-hour sun position control (`00:00` to `24:00`) with instant "NOW" button.
  - **Dynamic Solar Shadows**: Browser-side vector projection of building and tree shadows with soft feathered edges (`SolarShadowsLayer`).
  - **Low-Poly 3D Trees & Ground Shade**: Extruded tree models with dual blurred map-aligned ground shade patches (`TreeShadeLayer`).
  - **Directional Camera Occlusion**: Camera-facing occlusion corridors that automatically dim obstructing buildings (`BuildingsLayer`).
  - **Route Selection & Comparison**: Side-by-side Fastest vs Cooler comparison cards with distance, travel time, and length-weighted heat/shade statistics.
- **Backend**: FastAPI + NetworkX + OSMnx + GeoPandas + Shapely + Astral + Rasterio.
  - NetworkX Dijkstra shortest-path routing with non-negative edge weights.
  - Parallel edge resolution on OSMnx `MultiDiGraph`.
  - In-memory graph caching on startup for sub-10ms response times.
  - Dual endpoint support: `POST /api/routes` and `POST /api/route`.
- **Geospatial Pipeline**:
  - Metric coordinate system: `EPSG:32645` (WGS 84 / UTM zone 45N).
  - Web map interface: `EPSG:4326` (WGS 84 longitude/latitude).
  - Continuous length-weighted sampling of SOLWEIG daytime UTCI raster along edge geometries.

---

## Data Files in `data/`

All datasets cover the Ravenshaw University campus study area in Cuttack:

| File | Type & CRS | Description |
|---|---|---|
| `data/buildings.geojson` | Vector (`EPSG:32645`) | 5,240 building footprints with verified `DN` attribute representing building height in metres. |
| `data/campus-buildings-optimized.geojson` | GeoJSON (`EPSG:4326`) | 397 campus building footprints with verified metric height (`height_m`). |
| `data/ravenshaw_building_dsm.tif` | Raster (`EPSG:32645`) | 4-metre resolution digital surface model (building heights from 0m to 20.55m). |
| `data/utci_day_mean.tif` | Raster (`EPSG:32645`) | Calibrated SOLWEIG daytime mean UTCI raster (ranging from 41.64°C to 45.26°C). |
| `data/tmrt_day_mean.tif` | Raster (`EPSG:32645`) | Mean radiant temperature raster in degrees Celsius. |
| `data/ravenshaw_walk.graphml` | GraphML | Enriched pedestrian network (137 nodes, 310 edges) with shade fractions and UTCI scores. |
| `data/ravenshaw_bike.graphml` | GraphML | Enriched cycling network (137 nodes, 310 edges). |
| `data/ravenshaw_walk_edges.geojson` | GeoJSON (`EPSG:4326`) | Exported pedestrian edges with metric attributes. |

---

## Setup and Run Guide (Windows PowerShell)

### Prerequisites
- Python 3.10+ (or Python managed via `uv`)
- Node.js 20+ and npm

---

### Step 1: Backend Setup and Run

Open Windows PowerShell in the project root:

```powershell
# 1. Activate virtual environment
.\backend\.venv\Scripts\Activate.ps1

# 2. Run backend tests
python -m pytest backend/tests -v

# 3. Start the FastAPI backend server
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API will be available at `http://127.0.0.1:8000`.
- API Health check: `http://127.0.0.1:8000/api/health`
- Interactive Swagger docs: `http://127.0.0.1:8000/docs`

---

### Step 2: Frontend Setup and Run

In a separate Windows PowerShell window, navigate to `frontend/`:

```powershell
cd frontend

# 1. Install npm dependencies
npm install

# 2. Build production bundle to verify types and compilation
npm run build

# 3. Start the Vite development server
npm run dev
```

Open your browser to `http://localhost:5173`.

---

## Routing Cost Functions

- **Travel Time**:
  $$\text{travel\_time\_seconds} = \frac{\text{edge\_length\_metres}}{\text{assumed\_walking\_speed}}$$
  - Walking default: $1.4\text{ m/s}$ ($5.04\text{ km/h}$)

- **Fastest Route Objective**:
  $$\text{cost}\_{\text{fastest}} = \text{travel\_time\_seconds}$$

- **Cooler Route Objective**:
  $$\text{cost}\_{\text{cooler}} = \text{travel\_time\_seconds} \times (1 + \text{heat\_weight} \times \text{heat\_score})$$
  - Default $\text{heat\_weight} = 1.0$ (configurable in `backend/app/config.py`).
  - $\text{heat\_score} \in [0, 1]$:
    - Active source (UTCI): normalized relative daytime thermal heat distribution across campus edges.
    - Fallback source (Shadow): relative solar exposure score ($1 - \text{avg\_shade\_fraction}$).

---

## API Endpoints

### 1. `GET /api/health`
Returns backend readiness, loaded graph statistics, and active heat source.

### 2. `POST /api/routes` (and alias `POST /api/route`)
Calculates fastest and cooler routes between two coordinates.

Request:
```json
{
  "origin": [85.8940, 20.4630],
  "destination": [85.8970, 20.4600],
  "profile": "walking",
  "alternatives": ["fastest", "weighted"]
}
```

Response includes:
- `routes`: Array containing both `fastest` and `weighted` (cooler) route options, each with `geometry`, `segments`, and `summary`.
- `fastest`: GeoJSON LineString geometry and stats (distance in meters, duration in minutes, average heat score, average UTCI in °C, modeled shade percentage).
- `cooler`: GeoJSON LineString geometry and stats.
- `heat_source`: Explicit metric identifier (`"utci"` or `"shadow"`).
- `heat_source_description`: Human-readable explanation.
- `snapped_start` & `snapped_end`: Coordinates snapped to the campus road network.
