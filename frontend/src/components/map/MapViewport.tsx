import { type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import { INITIAL_CAMERA, MAP_STYLE_URL } from "@/lib/map/config";
import { MapProvider } from "./map-context";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { setWorkerUrl } from "maplibre-gl";

setWorkerUrl(mapLibreWorkerUrl);

export function MapViewport({ children }: { children?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const instance = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      center: [0, 0],
      zoom: 1,
      pitch: INITIAL_CAMERA.pitch,
      bearing: INITIAL_CAMERA.bearing,
      attributionControl: { compact: true },
    });

    instance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    mapRef.current = instance;
    instance.on("load", () => {
      for (const shieldId of [
        "highway-shield-non-us",
        "highway-shield-us-interstate",
        "road-shield-us",
      ]) {
        if (instance.getLayer(shieldId)) instance.removeLayer(shieldId);
      }

      if (import.meta.env.DEV) {
        (window as unknown as { __map?: typeof instance }).__map = instance;
      }

      setMap(instance);
    });

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (import.meta.env.DEV) {
        delete (window as unknown as { __map?: unknown }).__map;
      }
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  return (
    <MapProvider map={map}>
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
        {map && children && (
          <div className="pointer-events-none absolute inset-0">{children}</div>
        )}
      </div>
    </MapProvider>
  );
}
