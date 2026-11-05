import { useMemo } from "react";
import { Droplets, ThermometerSun, TreePine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { RouteOption } from "@/types/routes";
import { calculateRouteInsights } from "@/features/routes/routeInsights";

interface Props {
  route: RouteOption;
  expanded: boolean;
}

function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(2)} km`
    : `${Math.round(meters)} m`;
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/70 p-2 sm:p-2.5">
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]">
          {label}
        </span>
      </div>

      <p
        className="text-base font-bold leading-tight tabular-nums sm:text-lg"
        style={color ? { color } : undefined}
      >
        {value}
      </p>

      <p className="mt-0.5 truncate text-[9px] text-muted-foreground sm:text-[10px]">
        {detail}
      </p>
    </div>
  );
}

export function RouteInsights({ route, expanded }: Props) {
  const insights = useMemo(() => calculateRouteInsights(route), [route]);

  return (
    <section className="mt-2 rounded-xl border border-border bg-card p-2 sm:mt-3 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-card-foreground sm:text-sm">
            Route insights
          </p>

          {expanded && (
            <p className="text-[10px] text-muted-foreground">
              Environmental breakdown of the selected route
            </p>
          )}
        </div>

        <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[8px] font-semibold text-secondary-foreground">
          DEMO ESTIMATES
        </span>
      </div>

      {/* Always-visible summary */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <Metric
          icon={ThermometerSun}
          label="Heat"
          value={`${insights.averageHeatScore}/100`}
          detail={insights.averageHeatLabel}
          color={insights.averageHeatColor}
        />

        <Metric
          icon={TreePine}
          label="Shade"
          value={`${Math.round(insights.shadePercent)}%`}
          detail={`${formatDistance(insights.shadedDistanceM)} est.`}
        />

        <Metric
          icon={Droplets}
          label="Water"
          value={String(insights.nearbyWaterCount)}
          detail="Within 60 m"
        />
      </div>

      {expanded && (
        <>
          {/* Heat distribution */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-card-foreground">
                Heat exposure breakdown
              </p>

              <span className="text-[10px] text-muted-foreground">
                By route distance
              </span>
            </div>

            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              aria-label="Route heat exposure distribution"
            >
              {insights.heatBreakdown.map((band) => (
                <div
                  key={band.id}
                  title={`${band.label}: ${Math.round(band.percent)}%`}
                  style={{
                    width: `${band.percent}%`,
                    backgroundColor: band.color,
                  }}
                />
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              {insights.heatBreakdown.map((band) => (
                <div
                  key={band.id}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: band.color }}
                  />

                  <div className="min-w-0">
                    <p className="truncate text-[10px] text-muted-foreground">
                      {band.label}
                    </p>

                    <p className="text-xs font-semibold tabular-nums">
                      {formatDistance(band.distanceM)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nearby drinking-water points */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-sky-600" />

                <p className="text-xs font-semibold text-card-foreground">
                  Drinking water along the way
                </p>
              </div>

              <span className="text-[10px] text-muted-foreground">
                {insights.nearbyWaterCount} nearby
              </span>
            </div>

            {insights.nearbyWaterPoints.length > 0 ? (
              <div className="space-y-2">
                {insights.nearbyWaterPoints.map((point, index) => (
                  <div
                    key={point.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background/70 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {point.name}
                        </p>

                        <p className="text-[10px] text-muted-foreground">
                          {formatDistance(point.alongRouteM)} along route
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums">
                        {formatDistance(point.distanceFromRouteM)}
                      </p>

                      <p className="text-[10px] text-muted-foreground">
                        off route
                      </p>
                    </div>
                  </div>
                ))}

                {insights.nearbyWaterCount > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{insights.nearbyWaterCount - 3} more nearby water points
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-background/70 px-3 py-3 text-xs text-muted-foreground">
                No marked water points within 60 m of this route.
              </p>
            )}
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Heat and shade are estimated from synthetic tree data. Water
            locations are illustrative demo points, not verified facilities.
          </p>
        </>
      )}
    </section>
  );
}
