import { useState } from "react";
import { BuildingsLayer } from "@/components/map/BuildingsLayer";
import { RouteLegend } from "@/components/map/RouteLegend";
import { RoutesLayer } from "@/components/map/RoutesLayer";
import { MapViewport } from "@/components/map/MapViewport";
import { CampusBuildingCellsLayer } from "@/components/map/CampusBuildingCellsLayer";
import { RoadNetworkLayer } from "@/components/map/RoadNetworkLayer";
import { RouteWaypointsLayer } from "@/components/map/RouteWaypointsLayer";
import { TreeShadeLayer } from "@/components/map/TreeShadeLayer";
import { WaterPointsLayer } from "@/components/map/WaterPointsLayer";
import { RouteSelectionPanel } from "@/components/map/RouteSelectionPanel";
import { RouteMapPicker } from "@/components/map/RouteMapPicker";
import {
  RouteInputProvider,
  useRouteInputs,
} from "@/features/routes/route-input-context";

import type { RouteKind } from "@/types/routes";

function AppContent() {
  const [selectedRouteKind, setSelectedRouteKind] =
    useState<RouteKind>("weighted");

  const { selectionMode, setSelectionMode } = useRouteInputs();

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer />
          <CampusBuildingCellsLayer selectedRouteKind={selectedRouteKind} />
          <TreeShadeLayer />
          <RoadNetworkLayer />
          <WaterPointsLayer />
          <RoutesLayer selectedRouteKind={selectedRouteKind} />
          <RouteWaypointsLayer selectedRouteKind={selectedRouteKind} />
          <RouteMapPicker />
        </MapViewport>

        <RouteLegend />

        {selectionMode && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-md">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />

              <p className="text-xs font-semibold text-card-foreground">
                Click the map to set your {selectionMode}
              </p>

              <button
                type="button"
                onClick={() => setSelectionMode(null)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <RouteSelectionPanel
          selectedRouteKind={selectedRouteKind}
          onSelectRoute={setSelectedRouteKind}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <RouteInputProvider>
      <AppContent />
    </RouteInputProvider>
  );
}
