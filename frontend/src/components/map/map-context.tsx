import { type Map as MapLibreMap } from "maplibre-gl";
import { createContext, useContext, type ReactNode } from "react";

const MapContext = createContext<MapLibreMap | null>(null);

export function MapProvider({
  map,
  children,
}: {
  map: MapLibreMap | null;
  children: ReactNode;
}) {
  return <MapContext.Provider value={map}>{children}</MapContext.Provider>;
}

export function useMap(): MapLibreMap | null {
  return useContext(MapContext);
}
