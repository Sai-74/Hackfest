import { mockRouteOptions } from "@/services/mock/demoRoutes";
import type { LonLat, RouteOption } from "@/types/routes";
import { DEMO_TREES } from "@/services/mock/demoTrees";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== "false";

interface BackendRouteRequest {
  start: LonLat;
  end: LonLat;
  mode: "walk";
  solar_time_minutes: number;
  trees: {
    position: LonLat;
    height_m: number;
    shade_radius_m: number;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || isNumber(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isLonLat(value: unknown): value is LonLat {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    isNumber(value[0]) &&
    isNumber(value[1]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function isRouteOption(value: unknown): value is RouteOption {
  if (!isRecord(value)) return false;

  if (
    typeof value.id !== "string" ||
    (value.kind !== "fastest" && value.kind !== "weighted") ||
    !Array.isArray(value.geometry) ||
    value.geometry.length < 2 ||
    !value.geometry.every(isLonLat) ||
    !Array.isArray(value.segments) ||
    !isRecord(value.summary)
  ) {
    return false;
  }

  const validSegments = value.segments.every((segment) => {
    if (!isRecord(segment)) return false;

    return (
      isNumber(segment.startDist) &&
      isNumber(segment.endDist) &&
      isNumber(segment.score) &&
      segment.startDist >= 0 &&
      segment.endDist > segment.startDist &&
      segment.score >= 0 &&
      segment.score <= 100
    );
  });

  const summary = value.summary;

  return (
    validSegments &&
    isNumber(summary.distanceM) &&
    isNumber(summary.durationMin) &&
    summary.distanceM > 0 &&
    summary.durationMin >= 0 &&
    isOptionalNumber(summary.avgHeatScore) &&
    isOptionalNumber(summary.avgShadeFraction) &&
    isOptionalNumber(summary.avgUtciDegC) &&
    isOptionalString(summary.heatSource) &&
    isOptionalString(summary.heatSourceLabel)
  );
}

function parseRouteResponse(payload: unknown): RouteOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.routes)) {
    throw new Error("Invalid backend response: expected a routes array.");
  }

  const routes = payload.routes;

  if (!routes.every(isRouteOption)) {
    throw new Error("Backend returned malformed route data.");
  }

  const kinds = new Set(routes.map((route) => route.kind));

  if (!kinds.has("fastest") || !kinds.has("weighted")) {
    throw new Error("Backend must return both fastest and weighted routes.");
  }

  return routes;
}

function getErrorDetail(payload: unknown): string | null {
  if (!isRecord(payload) || payload.detail === undefined) {
    return null;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail
      .map((item) =>
        isRecord(item) && typeof item.msg === "string" ? item.msg : "",
      )
      .filter(Boolean)
      .join("; ");
  }

  return null;
}

interface FetchRouteOptionsInput {
  origin: LonLat;
  destination: LonLat;
  signal?: AbortSignal;
  solarTimeMinutes?: number;
}

export async function fetchRouteOptions({
  origin,
  destination,
  signal,
  solarTimeMinutes,
}: FetchRouteOptionsInput): Promise<RouteOption[]> {
  if (USE_MOCK) {
    return mockRouteOptions(origin, destination, solarTimeMinutes ?? 12 * 60);
  }

  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

  if (!base) {
    throw new Error(
      "VITE_API_BASE_URL is missing. Configure frontend/.env.local.",
    );
  }

  const request: BackendRouteRequest = {
    start: origin,
    end: destination,
    mode: "walk",
    solar_time_minutes: solarTimeMinutes ?? 12 * 60,
    trees: DEMO_TREES.map((tree) => ({
      position: tree.position,
      height_m: tree.heightM,
      shade_radius_m: tree.shadeRadiusM,
    })),
  };

  let response: Response;

  try {
    response = await fetch(`${base}/api/routes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;

    throw new Error(
      `Could not connect to the CoolRoute backend at ${base}. Check that FastAPI is running.`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = getErrorDetail(payload);

    throw new Error(
      detail ?? `Routing request failed: HTTP ${response.status}`,
    );
  }

  return parseRouteResponse(payload);
}
