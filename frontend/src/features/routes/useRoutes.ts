import { useQuery } from "@tanstack/react-query";
import { fetchRouteOptions } from "@/services/routes";

export function useRoutes() {
  return useQuery({
    queryKey: ["route-options"],
    queryFn: fetchRouteOptions,
    staleTime: Infinity,
  });
}
