import { useQuery } from "@tanstack/react-query";

import { fetchRouteOptions } from "@/services/routes";
import { useRouteInputs } from "./route-input-context";

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export function useRoutes() {
  const { origin, destination } = useRouteInputs();

  return useQuery({
    queryKey: ["route-options", origin, destination],

    queryFn: ({ signal }) =>
      fetchRouteOptions({
        origin,
        destination,
        signal,
      }),

    staleTime: Infinity,
    retry: false,
    refetchInterval: USE_MOCK_DATA ? 60_000 : false,
  });
}
