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
import { SolarShadowsLayer } from "./components/map/SolarShadowsLayer";

function AppContent() {
  const [selectedRouteKind, setSelectedRouteKind] =
    useState<RouteKind>("weighted");

  const { selectionMode, setSelectionMode } = useRouteInputs();

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer selectedRouteKind={selectedRouteKind} />
          <CampusBuildingCellsLayer selectedRouteKind={selectedRouteKind} />
          <TreeShadeLayer />
          <SolarShadowsLayer />
          <RoadNetworkLayer />
          <WaterPointsLayer />
          <RoutesLayer selectedRouteKind={selectedRouteKind} />
          <RouteWaypointsLayer selectedRouteKind={selectedRouteKind} />
          <RouteMapPicker />
        </MapViewport>

        {!selectionMode && <RouteLegend />}

        {selectionMode && (
          <div className="absolute inset-x-0 top-3 z-30 flex justify-center px-3">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>

              <p className="text-xs font-semibold text-card-foreground">
                Tap map to set {selectionMode}
              </p>

              <button
                type="button"
                onClick={() => setSelectionMode(null)}
                className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground hover:bg-primary/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!selectionMode && (
          <RouteSelectionPanel
            selectedRouteKind={selectedRouteKind}
            onSelectRoute={setSelectedRouteKind}
          />
        )}
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
