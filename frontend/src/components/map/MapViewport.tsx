import { type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import { INITIAL_CAMERA, MAP_STYLE_URL } from "@/lib/map/config";
import { MapProvider } from "./map-context";

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
    instance.on("load", () => setMap(instance));

    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  return (
    <MapProvider map={map}>
      <div ref={containerRef} className="absolute inset-0">
        {map ? children : null}
      </div>
    </MapProvider>
  );
}
