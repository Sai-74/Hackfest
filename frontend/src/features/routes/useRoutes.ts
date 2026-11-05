import { useQuery } from "@tanstack/react-query";

import { fetchRouteOptions } from "@/services/routes";
import { useRouteInputs } from "./route-input-context";

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
  });
}
