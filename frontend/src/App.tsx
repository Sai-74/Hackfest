import { BuildingsLayer } from "@/components/map/BuildingsLayer";
import { RouteLegend } from "@/components/map/RouteLegend";
import { RoutesLayer } from "@/components/map/RoutesLayer";
import { MapViewport } from "@/components/map/MapViewport";
import { CampusBuildingCellsLayer } from "./components/map/CampusBuildingCellsLayer";
import { RoadNetworkLayer } from "./components/map/RoadNetworkLayer";

export default function App() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer />
          <CampusBuildingCellsLayer />
          <RoadNetworkLayer />
          <RoutesLayer />
        </MapViewport>
        <RouteLegend />
      </main>
    </div>
  );
}
