import { mockRouteOptions } from "@/services/mock/demoRoutes";
import type { RouteOption } from "@/types/routes";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export async function fetchRouteOptions(): Promise<RouteOption[]> {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return mockRouteOptions();
  }
  const base = import.meta.env.VITE_API_BASE_URL;
  if (!base) {
    throw new Error("VITE_API_BASE_URL is unset while mock data is disabled");
  }
  throw new Error("Backend route contract not implemented yet");
}
