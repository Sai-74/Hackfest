# CoolRoute 🚶☀️🌳

> **A heat-aware walking route planner for Ravenshaw University, Cuttack.**

During hot daylight hours in Cuttack, walking through sun-exposed campus concrete can quickly lead to thermal discomfort and heat stress. Traditional navigation apps optimize strictly for distance or time, guiding pedestrians down the hottest, most unshaded paths. 

**CoolRoute** solves this by calculating and comparing two route alternatives side-by-side: the **Fastest route** (minimizing walking time) and the **Cooler route** (prioritizing building shadows, tree canopy, and reduced thermal radiation).

---

## ✨ Features

- **Route Comparison**: Compare travel time, distance, and relative heat score between the Fastest and Cooler walking paths.
- **Interactive Campus 3D Map**: Built on MapLibre GL with fluid camera rotation, tilt, and directional building occlusion.
- **Dynamic Solar Shadows**: Client-side solar trigonometry calculating real-time building and tree shadows using local sun elevation and azimuth.
- **Time-of-Day Slider**: Slide through 24 hours to preview shifting shade patterns across campus, with an instant "NOW" button.
- **Thermal Heat Scoring**: Edge-by-edge heat weighting powered by daytime mean UTCI (*Universal Thermal Climate Index*) and canopy shade.
- **Demo Route Presets**: Instant one-click campus routes for immediate presentation without manual coordinate entry.

---

## 📸 Screenshots

| Route Comparison & Insights | Real-Time Sun & Shadow Simulation |
|:---:|:---:|
| *(Select between Fastest and Recommended Cooler paths)* | *(Dynamic building shadows and ground tree shade)* |

> *Tip: Run the application locally to interact with the live 3D map and solar time controls.*

---

## 🛠️ How It Works

CoolRoute combines a responsive React frontend with a high-performance Python geospatial routing engine:

1. **Frontend**: React 19, TypeScript, and Vite drive the interface. Vector map layers render building footprints, 3D trees, and animated route chevrons using MapLibre GL.
2. **Backend**: A lightweight FastAPI server caches the Ravenshaw campus pedestrian graph (`MultiDiGraph`) in memory and resolves Dijkstra shortest-path queries in under 10 milliseconds.
3. **Heat-Aware Routing**:
   - **Fastest Objective**: Minimizes travel time based on edge length at a standard walking speed of 1.4 m/s.
   - **Cooler Objective**: Applies a thermal penalty multiplier:
     $$\text{cost} = \text{travel\_time} \times (1 + \text{heat\_weight} \times \text{heat\_score})$$
4. **Data Clarification (Precomputed Heat vs. Dynamic Shadows)**:
   - **Routing Layer**: Edge heat scores are precomputed from a calibrated **SOLWEIG daytime mean UTCI raster** (`utci_day_mean.tif`, 41.6°C–45.3°C). Routing reflects length-weighted thermal stress across daytime conditions.
   - **Visual Layer**: The interactive time-of-day slider drives visual vector shadow polygons dynamically in the browser using exact solar coordinates for Cuttack (20.463° N, 85.894° E).

---

## 💻 Tech Stack

- **Frontend**: React 19, TypeScript, Vite, MapLibre GL, TanStack React Query, Tailwind CSS, Lucide Icons.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, NetworkX, OSMnx, Shapely, GeoPandas, Rasterio, Astral, PyTest.
- **Geodata**: EPSG:32645 (UTM Zone 45N) for metric analysis; EPSG:4326 (WGS84) for web mapping.

---

## 🚀 Run Locally

### Prerequisites
- Python 3.10+ (virtual environment recommended)
- Node.js 20+ and npm

### 1. Start Backend Server
In Windows PowerShell (project root):

```powershell
# Activate virtual environment
.\backend\.venv\Scripts\Activate.ps1

# Run tests
python -m pytest backend/tests -v

# Start FastAPI server (runs on http://127.0.0.1:8000)
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

*Interactive API documentation is available at `http://127.0.0.1:8000/docs`.*

### 2. Start Frontend App
In a second PowerShell window:

```powershell
cd frontend

# Install dependencies (first time only)
npm install

# Start Vite dev server (runs on http://localhost:5173)
npm run dev
```

Open `http://localhost:5173` in any desktop or mobile browser.

---

## 📁 Project Structure

```text
Hackfest-main/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI endpoints (/api/routes, /api/health)
│   │   ├── routing.py           # Dijkstra pathfinding & metric aggregation
│   │   ├── graph_loader.py      # Spatial indexing & GraphML loader
│   │   └── models.py            # Pydantic schemas for request/response
│   └── tests/
│       └── test_routing.py      # Automated API & routing tests
├── frontend/
│   ├── src/
│   │   ├── components/map/      # MapLibre layers, Shadows, & Solar controls
│   │   ├── features/routes/     # Routing state, context, & UI panels
│   │   └── services/            # Backend API client & schema validator
│   └── public/data/             # Web-optimized campus buildings & network
├── data/                        # Campus GraphML, building DSM, & UTCI rasters
└── scripts/
    ├── calculate_edge_heat.py   # Preprocessing: building shadows & UTCI sampling
    └── compute_shadows.py       # Standalone shadow testing utility
```

---

## 📚 Acknowledgements & Data

- **OpenStreetMap Contributors**: Base street network and campus boundary geometries.
- **SOLWEIG Solar & Heat Model**: Calibrated 4m Digital Surface Model (`ravenshaw_building_dsm.tif`) and daytime mean UTCI thermal raster (`utci_day_mean.tif`) covering the Ravenshaw University campus study area.
