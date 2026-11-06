import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { DEMO_DESTINATION, DEMO_ORIGIN } from "@/lib/map/config";

import type { LonLat } from "@/types/routes";

export type RoutePickMode = "origin" | "destination" | null;

interface RouteInputContextValue {
  origin: LonLat;
  destination: LonLat;
  selectionMode: RoutePickMode;
  setSelectionMode: (mode: RoutePickMode) => void;
  selectLocation: (coordinate: LonLat) => void;
  swapEndpoints: () => void;
  resetEndpoints: () => void;
}

const RouteInputContext = createContext<RouteInputContextValue | null>(null);

export function RouteInputProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<LonLat>(DEMO_ORIGIN);
  const [destination, setDestination] = useState<LonLat>(DEMO_DESTINATION);

  const [selectionMode, setSelectionMode] = useState<RoutePickMode>(null);

  const selectLocation = useCallback(
    (coordinate: LonLat) => {
      if (selectionMode === "origin") {
        setOrigin(coordinate);
        setSelectionMode(null);
      } else if (selectionMode === "destination") {
        setDestination(coordinate);
        setSelectionMode(null);
      }
    },
    [selectionMode],
  );

  const swapEndpoints = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    setSelectionMode(null);
  }, [origin, destination]);

  const resetEndpoints = useCallback(() => {
    setOrigin(DEMO_ORIGIN);
    setDestination(DEMO_DESTINATION);
    setSelectionMode(null);
  }, []);

  return (
    <RouteInputContext.Provider
      value={{
        origin,
        destination,
        selectionMode,
        setSelectionMode,
        selectLocation,
        swapEndpoints,
        resetEndpoints,
      }}
    >
      {children}
    </RouteInputContext.Provider>
  );
}

export function useRouteInputs() {
  const context = useContext(RouteInputContext);

  if (!context) {
    throw new Error("useRouteInputs must be used inside RouteInputProvider.");
  }

  return context;
}
