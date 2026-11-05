import { MapLibreMap } from "maplibre-gl";
import React, { createContext, useContext } from "react";

const MapContext = createContext<MapLibreMap | null>(null);

export function MapProvider({
  map,
  children,
}: {
  map: MapLibreMap | null;
  children: React.ReactNode;
}) {
  return <MapContext.Provider value={map}>{children}</MapContext.Provider>;
}

export function useMap(): MapLibreMap | null {
  return useContext(MapContext);
}
