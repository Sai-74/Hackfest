import { BuildingsLayer } from "@/components/map/BuildingsLayer";
import { RouteLegend } from "@/components/map/RouteLegend";
import { RoutesLayer } from "@/components/map/RoutesLayer";
import { MapViewport } from "@/components/map/MapViewport";
import { CampusBuildingCellsLayer } from "./components/map/CampusBuildingCellsLayer";
import { RoadNetworkLayer } from "./components/map/RoadNetworkLayer";
import { RouteWaypointsLayer } from "./components/map/RouteWaypointsLayer";
import { TreeShadeLayer } from "./components/map/TreeShadeLayer";

export default function App() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer />
          <CampusBuildingCellsLayer />
          <TreeShadeLayer />
          <RoadNetworkLayer />
          <RoutesLayer />
          <RouteWaypointsLayer />
        </MapViewport>
        <RouteLegend />
      </main>
    </div>
  );
}
