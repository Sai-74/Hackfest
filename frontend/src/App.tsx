import { useState } from "react";
import { BuildingsLayer } from "@/components/map/BuildingsLayer";
import { RouteLegend } from "@/components/map/RouteLegend";
import { RoutesLayer } from "@/components/map/RoutesLayer";
import { MapViewport } from "@/components/map/MapViewport";
import { CampusBuildingCellsLayer } from "./components/map/CampusBuildingCellsLayer";
import { RoadNetworkLayer } from "./components/map/RoadNetworkLayer";
import { RouteWaypointsLayer } from "./components/map/RouteWaypointsLayer";
import { TreeShadeLayer } from "./components/map/TreeShadeLayer";
import { WaterPointsLayer } from "./components/map/WaterPointsLayer";
import { RouteSelectionPanel } from "./components/map/RouteSelectionPanel";
import type { RouteKind } from "@/types/routes";

export default function App() {
  const [selectedRouteKind, setSelectedRouteKind] =
    useState<RouteKind>("weighted");

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer />
          <CampusBuildingCellsLayer />
          <TreeShadeLayer />
          <RoadNetworkLayer />
          <WaterPointsLayer />
          <RoutesLayer selectedRouteKind={selectedRouteKind} />
          <RouteWaypointsLayer selectedRouteKind={selectedRouteKind} />
        </MapViewport>

        <RouteLegend />

        <RouteSelectionPanel
          selectedRouteKind={selectedRouteKind}
          onSelectRoute={setSelectedRouteKind}
        />
      </main>
    </div>
  );
}
