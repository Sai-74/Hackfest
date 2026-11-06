import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchRouteOptions } from "@/services/routes";
import { useRouteInputs } from "./route-input-context";
import { useSolarTime } from "@/features/shade/solar-time-context";

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export function useRoutes() {
  const { origin, destination } = useRouteInputs();
  const { timeMinutes } = useSolarTime();

  const [debouncedTimeMinutes, setDebouncedTimeMinutes] = useState(timeMinutes);

  useEffect(() => {
    if (USE_MOCK_DATA) {
      setDebouncedTimeMinutes(timeMinutes);
      return;
    }

    const timeout = window.setTimeout(() => {
      setDebouncedTimeMinutes(timeMinutes);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [timeMinutes]);

  const requestTimeMinutes = USE_MOCK_DATA ? timeMinutes : debouncedTimeMinutes;

  return useQuery({
    queryKey: ["route-options", origin, destination, requestTimeMinutes],

    queryFn: ({ signal }) =>
      fetchRouteOptions({
        origin,
        destination,
        signal,
        solarTimeMinutes: requestTimeMinutes,
      }),

    staleTime: Infinity,
    retry: false,
  });
}
