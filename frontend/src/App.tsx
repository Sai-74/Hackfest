import { BuildingsLayer } from "./components/map/BuildingsLayer";
import { MapViewport } from "./components/map/MapViewport";

export default function App() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <MapViewport>
          <BuildingsLayer />
        </MapViewport>
      </main>
    </div>
  );
}
