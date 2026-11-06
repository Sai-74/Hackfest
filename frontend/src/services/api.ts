import type { HealthResponse, RouteResponse, TransportMode } from '../types/route';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function checkBackendHealth(): Promise<HealthResponse> {
  const url = `${API_BASE}/api/health`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Backend health check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function requestRoute(
  start: [number, number],
  end: [number, number],
  mode: TransportMode,
  heatWeight?: number,
  heatSource?: 'utci' | 'shadow'
): Promise<RouteResponse> {
  const url = `${API_BASE}/api/route`;
  const body = {
    start,
    end,
    mode,
    ...(heatWeight !== undefined ? { heat_weight: heatWeight } : {}),
    ...(heatSource ? { heat_source: heatSource } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errorDetail = `Routing request failed with HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}
