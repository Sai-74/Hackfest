import { useRoutes } from "@/features/routes/useRoutes";
import { heatBandFor } from "@/features/heat/heatScale";
import type { RouteKind, RouteOption } from "@/types/routes";

interface Props {
  selectedRouteKind: RouteKind;
  onSelectRoute: (kind: RouteKind) => void;
}

function averageHeat(route: RouteOption): number {
  const totalLength = route.segments.reduce(
    (sum, segment) => sum + segment.endDist - segment.startDist,
    0,
  );

  if (totalLength <= 0) return 0;

  const weightedScore = route.segments.reduce(
    (sum, segment) =>
      sum + segment.score * (segment.endDist - segment.startDist),
    0,
  );

  return Math.round(weightedScore / totalLength);
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatDuration(minutes: number): string {
  return `${Math.max(1, Math.round(minutes))} min walk`;
}

function RouteOptionCard({
  route,
  selected,
  onSelect,
  title,
  subtitle,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  const heat = averageHeat(route);
  const band = heatBandFor(heat);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        "flex min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-card text-card-foreground hover:border-primary/50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide">
          {title}
        </span>

        {selected ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
            SELECTED
          </span>
        ) : (
          <span className="text-[10px] opacity-65">SELECT</span>
        )}
      </div>

      <p className="text-xs opacity-70">{subtitle}</p>

      <div>
        <p className="text-xl font-bold leading-tight tabular-nums">
          {formatDistance(route.summary.distanceM)}
        </p>
        <p className="mt-0.5 text-xs opacity-75">
          {formatDuration(route.summary.durationMin)}
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: band.color }}
        />
        <span>{band.label}</span>
        <span className="ml-auto font-semibold tabular-nums">{heat}/100</span>
      </div>
    </button>
  );
}

export function RouteSelectionPanel({
  selectedRouteKind,
  onSelectRoute,
}: Props) {
  const { data } = useRoutes();

  const fastest = data?.find((route) => route.kind === "fastest");
  const recommended = data?.find((route) => route.kind === "weighted");

  if (!fastest || !recommended) return null;

  return (
    <section className="pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(94vw,680px)] -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-sm font-bold text-card-foreground">
            Choose your route
          </p>
          <p className="text-[11px] text-muted-foreground">
            Campus walking routes
          </p>
        </div>

        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
          SHADE-AWARE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <RouteOptionCard
          route={fastest}
          selected={selectedRouteKind === "fastest"}
          onSelect={() => onSelectRoute("fastest")}
          title="Fastest"
          subtitle="Shortest walking distance"
        />

        <RouteOptionCard
          route={recommended}
          selected={selectedRouteKind === "weighted"}
          onSelect={() => onSelectRoute("weighted")}
          title="Recommended"
          subtitle="Lower heat exposure"
        />
      </div>

      <p className="mt-2 px-1 text-[10px] text-muted-foreground">
        Environmental scores are synthetic demo estimates.
      </p>
    </section>
  );
}
