import { useEffect } from "react";
import * as maplibregl from "maplibre-gl";

import { useMap } from "./map-context";
import { useRouteInputs } from "@/features/routes/route-input-context";
import type { LonLat } from "@/types/routes";

export function RouteMapPicker() {
  const map = useMap();

  const { selectionMode, selectLocation } = useRouteInputs();

  useEffect(() => {
    if (!map || !selectionMode) return;

    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;

    canvas.style.cursor = "crosshair";

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      const coordinate: LonLat = [event.lngLat.lng, event.lngLat.lat];

      selectLocation(coordinate);
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
      canvas.style.cursor = previousCursor;
    };
  }, [map, selectionMode, selectLocation]);

  return null;
}
