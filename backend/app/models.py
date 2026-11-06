from typing import Literal, Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator

class RouteRequest(BaseModel):
    start: List[float] = Field(
        ...,
        description="Starting coordinate as [longitude, latitude]",
        min_length=2,
        max_length=2
    )
    end: List[float] = Field(
        ...,
        description="Destination coordinate as [longitude, latitude]",
        min_length=2,
        max_length=2
    )
    mode: Literal["walk", "bike"] = Field(
        default="walk",
        description="Transport mode: walk or bike"
    )
    heat_weight: Optional[float] = Field(
        default=None,
        description="Custom heat penalty multiplier (>= 0)"
    )
    heat_source: Optional[Literal["utci", "shadow"]] = Field(
        default=None,
        description="Heat metric source: 'utci' or 'shadow'"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize origin -> start
            if "start" not in data and "origin" in data:
                data["start"] = data["origin"]
            # Normalize destination -> end
            if "end" not in data and "destination" in data:
                data["end"] = data["destination"]
            # Normalize profile -> mode
            if "mode" not in data and "profile" in data:
                p = str(data["profile"]).lower()
                data["mode"] = "bike" if ("bike" in p or "cycl" in p) else "walk"
        return data

    @field_validator("start", "end")
    @classmethod
    def validate_coordinates(cls, v: List[float]) -> List[float]:
        lon, lat = v[0], v[1]
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude {lon} out of range [-180, 180]")
        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude {lat} out of range [-90, 90]")
        return v

class RouteStats(BaseModel):
    distance_m: float
    duration_min: float
    avg_heat_score: float
    avg_utci_deg_c: Optional[float] = None
    avg_shade_fraction: float
    heat_source: str
    heat_source_label: str

class GeoJSONLineString(BaseModel):
    type: Literal["LineString"] = "LineString"
    coordinates: List[List[float]]

class FrontendRouteSegment(BaseModel):
    startDist: float
    endDist: float
    score: float

class FrontendRouteSummary(BaseModel):
    distanceM: float
    durationMin: float
    avgHeatScore: Optional[float] = None
    avgShadeFraction: Optional[float] = None
    avgUtciDegC: Optional[float] = None
    heatSource: Optional[str] = None
    heatSourceLabel: Optional[str] = None

class FrontendRouteOption(BaseModel):
    id: str
    kind: Literal["fastest", "weighted"]
    geometry: List[List[float]]
    segments: List[FrontendRouteSegment]
    summary: FrontendRouteSummary

class RouteOption(BaseModel):
    type: Literal["fastest", "cooler"]
    name: str
    geometry: GeoJSONLineString
    stats: RouteStats

class RouteResponse(BaseModel):
    routes: List[FrontendRouteOption] = Field(default_factory=list)
    mode: Literal["walk", "bike"]
    fastest: RouteOption
    cooler: RouteOption
    heat_source: str
    heat_source_description: str
    snapped_start: List[float]
    snapped_end: List[float]

class HealthResponse(BaseModel):
    status: str
    walk_graph_loaded: bool
    bike_graph_loaded: bool
    nodes_count: Dict[str, int]
    edges_count: Dict[str, int]
    active_heat_source: str
    heat_sources_available: List[str]
    pilot_area: str
