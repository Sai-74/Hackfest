import { useQuery } from "@tanstack/react-query";

import { fetchRouteOptions } from "@/services/routes";
import { useRouteInputs } from "./route-input-context";
import { useSolarTime } from "@/features/shade/solar-time-context";

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export function useRoutes() {
  const { origin, destination } = useRouteInputs();
  const { timeMinutes } = useSolarTime();

  return useQuery({
    queryKey: [
      "route-options",
      origin,
      destination,
      USE_MOCK_DATA ? timeMinutes : null,
    ],

    queryFn: ({ signal }) =>
      fetchRouteOptions({
        origin,
        destination,
        signal,
        solarTimeMinutes: timeMinutes,
      }),

    staleTime: Infinity,
    retry: false,
  });
}
