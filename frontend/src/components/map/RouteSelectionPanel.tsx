import { useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronUp, MapPin } from "lucide-react";

import { useRoutes } from "@/features/routes/useRoutes";
import { useRouteInputs } from "@/features/routes/route-input-context";
import { heatBandFor } from "@/features/heat/heatScale";
import { RouteInsights } from "./RouteInsights";

import type { LonLat, RouteKind, RouteOption } from "@/types/routes";

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

function formatCoordinate(coordinate: LonLat): string {
  return `${coordinate[1].toFixed(5)}, ${coordinate[0].toFixed(5)}`;
}

function RouteOptionCard({
  route,
  selected,
  onSelect,
  title,
  subtitle,
  compact,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  compact: boolean;
}) {
  const heat = averageHeat(route);
  const band = heatBandFor(heat);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        "flex min-w-0 flex-col rounded-xl border text-left transition-all",
        compact ? "gap-1.5 p-2.5" : "gap-2 p-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-md"
          : "border-border bg-card text-card-foreground hover:border-primary/50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {title}
        </span>

        {selected ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold">
            SELECTED
          </span>
        ) : (
          <span className="text-[9px] opacity-60">SELECT</span>
        )}
      </div>

      {!compact && <p className="text-xs opacity-70">{subtitle}</p>}

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-lg font-bold leading-tight tabular-nums">
          {formatDistance(route.summary.distanceM)}
        </p>

        <span className="text-[10px] opacity-75">
          {Math.max(1, Math.round(route.summary.durationMin))} min
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
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
  const [expanded, setExpanded] = useState(false);

  const {
    origin,
    destination,
    setSelectionMode,
    swapEndpoints,
    resetEndpoints,
  } = useRouteInputs();

  const { data, isLoading, isFetching, isError, error, refetch } = useRoutes();

  const fastest = data?.find((route) => route.kind === "fastest");
  const recommended = data?.find((route) => route.kind === "weighted");

  const selectedRoute = data?.find((route) => route.kind === selectedRouteKind);

  function beginPicking(mode: "origin" | "destination") {
    setExpanded(false);
    setSelectionMode(mode);
  }

  return (
    <section
      className={[
        "pointer-events-auto absolute bottom-3 left-1/2 z-20",
        "w-[min(96vw,680px)] -translate-x-1/2",
        "rounded-2xl border border-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md sm:p-3",
        expanded
          ? "max-h-[min(78dvh,760px)] overflow-y-auto"
          : "overflow-hidden",
      ].join(" ")}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-card-foreground">
            Plan your route
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {expanded
              ? "Route endpoints and environmental details"
              : "Choose a route or change your endpoints"}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[10px] font-semibold text-secondary-foreground hover:bg-primary/10"
        >
          {expanded ? "Less" : "Details"}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Always-accessible endpoint selection */}
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          onClick={() => beginPicking("origin")}
          className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-2 py-2 text-xs font-semibold text-card-foreground transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
          <span className="truncate">Set start</span>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>

        <button
          type="button"
          onClick={swapEndpoints}
          title="Swap endpoints"
          aria-label="Swap origin and destination"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => beginPicking("destination")}
          className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-2 py-2 text-xs font-semibold text-card-foreground transition-colors hover:border-primary hover:bg-primary/5"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="truncate">Set destination</span>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Expanded endpoint information */}
      {expanded && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg bg-background/70 p-2">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">
              Origin
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold tabular-nums">
              {formatCoordinate(origin)}
            </p>
          </div>

          <div className="min-w-0 rounded-lg bg-background/70 p-2">
            <p className="text-[9px] font-bold uppercase text-muted-foreground">
              Destination
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold tabular-nums">
              {formatCoordinate(destination)}
            </p>
          </div>

          <button
            type="button"
            onClick={resetEndpoints}
            className="col-span-2 text-left text-[10px] font-semibold text-muted-foreground hover:text-foreground"
          >
            Reset demo locations
          </button>
        </div>
      )}

      {isFetching && (
        <p className="mb-2 px-1 text-[10px] text-muted-foreground">
          Recalculating routes…
        </p>
      )}

      {isError && (
        <div
          role="alert"
          className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
        >
          <p className="text-xs text-destructive">
            {error instanceof Error
              ? error.message
              : "Could not calculate routes."}
          </p>

          <button
            type="button"
            onClick={() => void refetch()}
            className="shrink-0 text-xs font-semibold text-destructive underline"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && !data && (
        <div className="rounded-xl bg-secondary/60 p-4 text-center text-xs text-muted-foreground">
          Calculating routes…
        </div>
      )}

      {/* Route choices */}
      {fastest && recommended && selectedRoute && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <RouteOptionCard
              route={fastest}
              selected={selectedRouteKind === "fastest"}
              onSelect={() => onSelectRoute("fastest")}
              title="Fastest"
              subtitle="Shortest walking distance"
              compact={!expanded}
            />

            <RouteOptionCard
              route={recommended}
              selected={selectedRouteKind === "weighted"}
              onSelect={() => onSelectRoute("weighted")}
              title="Recommended"
              subtitle="Alternative, shade-aware route"
              compact={!expanded}
            />
          </div>

          <RouteInsights route={selectedRoute} expanded={expanded} />
        </>
      )}
    </section>
  );
}
