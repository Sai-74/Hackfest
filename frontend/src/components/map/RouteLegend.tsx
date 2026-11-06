import { HEAT_BANDS } from "@/features/heat/heatScale";

export function RouteLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-xl bg-overlay p-3 shadow-sm backdrop-blur-sm max-sm:bottom-auto max-sm:top-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Heat along selected route
      </p>
      <ul className="space-y-1">
        {HEAT_BANDS.map((band) => (
          <li
            key={band.id}
            className="flex items-center gap-2 text-xs text-foreground"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            {band.label}
          </li>
        ))}
      </ul>
      <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-2">
          <span className="inline-block w-4 border-b-2 border-dashed border-primary" />
          Alternative route
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-4 rounded-full bg-secondary" />
          Selected route
        </p>
      </div>
    </div>
  );
}
