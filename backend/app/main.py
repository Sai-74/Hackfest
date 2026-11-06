import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from . import config
from .graph_loader import graph_repo
from .models import RouteRequest, RouteResponse, HealthResponse
from .routing import calculate_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load and cache graphs
    print("[CoolRoute API] Initializing backend and loading graphs...", flush=True)
    graph_repo.load_graphs()
    yield
    print("[CoolRoute API] Shutting down.", flush=True)

app = FastAPI(
    title="CoolRoute Campus Pilot API",
    description="Thermal-aware and fastest walking/cycling routing around Ravenshaw University, Cuttack.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for local frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", response_model=HealthResponse)
def health_check():
    walk_loaded = "walk" in graph_repo.graphs
    bike_loaded = "bike" in graph_repo.graphs
    
    nodes_count = {
        m: len(g.nodes) for m, g in graph_repo.graphs.items()
    }
    edges_count = {
        m: len(g.edges) for m, g in graph_repo.graphs.items()
    }

    available_sources = ["shadow"]
    if graph_repo.has_utci_data:
        available_sources.insert(0, "utci")

    return HealthResponse(
        status="ready" if (walk_loaded and bike_loaded) else "degraded",
        walk_graph_loaded=walk_loaded,
        bike_graph_loaded=bike_loaded,
        nodes_count=nodes_count,
        edges_count=edges_count,
        active_heat_source="utci" if graph_repo.has_utci_data else "shadow",
        heat_sources_available=available_sources,
        pilot_area="Ravenshaw University, Cuttack, Odisha, India"
    )

@app.post("/api/route", response_model=RouteResponse)
@app.post("/api/routes", response_model=RouteResponse)
def compute_route(request: RouteRequest):
    return calculate_routes(request)

# Optionally serve compiled frontend if built
dist_dir = os.path.join(config.BASE_DIR, "frontend", "dist")
if os.path.exists(dist_dir):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")


