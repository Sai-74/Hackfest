import { mockRouteOptions } from "@/services/mock/demoRoutes";
import type { LonLat, RouteOption, RouteKind } from "@/types/routes";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== "false";

interface RouteRequest {
  origin: LonLat;
  destination: LonLat;
  profile: "walking";
  alternatives: RouteKind[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

  return (
    validSegments &&
    isNumber(value.summary.distanceM) &&
    isNumber(value.summary.durationMin) &&
    value.summary.distanceM > 0 &&
    value.summary.durationMin >= 0
  );
}

function parseRouteResponse(payload: unknown): RouteOption[] {
  if (!isRecord(payload) || !Array.isArray(payload.routes)) {
    throw new Error("Invalid routes API response: expected a routes array.");
  }

  const routes = payload.routes;

  if (!routes.every(isRouteOption)) {
    throw new Error("Invalid routes API response: malformed route data.");
  }

  const kinds = new Set(routes.map((route) => route.kind));

  if (!kinds.has("fastest") || !kinds.has("weighted")) {
    throw new Error("Routes API must return both fastest and weighted routes.");
  }

  return routes;
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

  const base = import.meta.env.VITE_API_BASE_URL?.trim();

  if (!base) {
    throw new Error("VITE_API_BASE_URL is unset while mock data is disabled.");
  }

  const request: RouteRequest = {
    origin,
    destination,
    profile: "walking",
    alternatives: ["fastest", "weighted"],
  };

  const response = await fetch(`${base.replace(/\/+$/, "")}/api/routes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      isRecord(payload) && typeof payload.detail === "string"
        ? payload.detail
        : `HTTP ${response.status}`;

    throw new Error(`Routes API failed: ${detail}`);
  }

  return parseRouteResponse(payload);
}
