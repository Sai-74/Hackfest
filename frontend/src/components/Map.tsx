import React, { useEffect, useRef } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  Marker,
  LngLatBounds,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RAVENSHAW_CENTER, DEFAULT_ZOOM, CAMPUS_BOUNDS } from '../constants/campus';
import type { RouteResponse } from '../types/route';

interface MapProps {
  startPoint: [number, number] | null;
  endPoint: [number, number] | null;
  routeData: RouteResponse | null;
  selectedRouteType: 'cooler' | 'fastest';
  onMapClick: (coords: [number, number]) => void;
}

export const Map: React.FC<MapProps> = ({
  startPoint,
  endPoint,
  routeData,
  selectedRouteType,
  onMapClick,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const endMarkerRef = useRef<Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);

  // Keep ref up to date
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-basemap': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, © CARTO',
          },
        },
        layers: [
          {
            id: 'carto-basemap-layer',
            type: 'raster',
            source: 'carto-basemap',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: RAVENSHAW_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 14.5,
      maxZoom: 19,
      maxBounds: CAMPUS_BOUNDS,
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      // Add Sources for Fastest and Cooler routes
      map.addSource('fastest-route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('cooler-route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Fastest Route Casing & Line (Amber/Orange)
      map.addLayer({
        id: 'fastest-route-casing',
        type: 'line',
        source: 'fastest-route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#78350f',
          'line-width': 7,
          'line-opacity': 0.8,
        },
      });

      map.addLayer({
        id: 'fastest-route-line',
        type: 'line',
        source: 'fastest-route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      });

      // Cooler Route Casing & Line (Cyan / Emerald glow)
      map.addLayer({
        id: 'cooler-route-casing',
        type: 'line',
        source: 'cooler-route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#064e3b',
          'line-width': 9,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'cooler-route-line',
        type: 'line',
        source: 'cooler-route-source',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 6,
          'line-opacity': 1.0,
        },
      });
    });

    map.on('click', (e: MapMouseEvent) => {
      onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Start Marker (Green Pin)
    if (startPoint) {
      if (!startMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black cursor-pointer transform hover:scale-110 transition-transform';
        el.innerHTML = 'A';
        startMarkerRef.current = new Marker({ element: el })
          .setLngLat(startPoint)
          .addTo(map);
      } else {
        startMarkerRef.current.setLngLat(startPoint);
      }
    } else if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }

    // Destination Marker (Red Pin)
    if (endPoint) {
      if (!endMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-7 h-7 rounded-full bg-rose-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black cursor-pointer transform hover:scale-110 transition-transform';
        el.innerHTML = 'B';
        endMarkerRef.current = new Marker({ element: el })
          .setLngLat(endPoint)
          .addTo(map);
      } else {
        endMarkerRef.current.setLngLat(endPoint);
      }
    } else if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }
  }, [startPoint, endPoint]);

  // Update Route Layers and Fit Bounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const fastestSource = map.getSource('fastest-route-source') as GeoJSONSource | undefined;
    const coolerSource = map.getSource('cooler-route-source') as GeoJSONSource | undefined;

    if (!routeData) {
      if (fastestSource) fastestSource.setData({ type: 'FeatureCollection', features: [] });
      if (coolerSource) coolerSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    if (fastestSource) {
      fastestSource.setData({
        type: 'Feature',
        geometry: routeData.fastest.geometry,
        properties: {},
      });
    }

    if (coolerSource) {
      coolerSource.setData({
        type: 'Feature',
        geometry: routeData.cooler.geometry,
        properties: {},
      });
    }

    // Adjust layer width/opacity based on selected route type
    if (map.getLayer('fastest-route-line') && map.getLayer('cooler-route-line')) {
      if (selectedRouteType === 'fastest') {
        map.setPaintProperty('fastest-route-line', 'line-width', 7);
        map.setPaintProperty('fastest-route-line', 'line-opacity', 1.0);
        map.setPaintProperty('cooler-route-line', 'line-width', 4);
        map.setPaintProperty('cooler-route-line', 'line-opacity', 0.65);
      } else {
        map.setPaintProperty('cooler-route-line', 'line-width', 7);
        map.setPaintProperty('cooler-route-line', 'line-opacity', 1.0);
        map.setPaintProperty('fastest-route-line', 'line-width', 4);
        map.setPaintProperty('fastest-route-line', 'line-opacity', 0.65);
      }
    }

    // Fit map bounds to show entire route
    const allCoords = [
      ...routeData.fastest.geometry.coordinates,
      ...routeData.cooler.geometry.coordinates,
    ];
    if (allCoords.length > 0) {
      const bounds = allCoords.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new LngLatBounds(allCoords[0] as [number, number], allCoords[0] as [number, number])
      );
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 250, left: 50, right: 50 },
        maxZoom: 17.5,
        duration: 800,
      });
    }
  }, [routeData, selectedRouteType]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};
