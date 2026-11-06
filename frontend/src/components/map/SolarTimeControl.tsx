import { useState } from "react";
import {
  ChevronDown,
  Clock3,
  LoaderCircle,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";

import { useSolarTime } from "@/features/shade/solar-time-context";
import { useRoutes } from "@/features/routes/useRoutes";

const TIME_PRESETS = [
  { label: "Morning", time: 8 * 60 + 30, icon: Sunrise },
  { label: "Noon", time: 12 * 60, icon: Sun },
  { label: "Evening", time: 16 * 60 + 30, icon: Sunset },
];

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function SolarTimeControl() {
  const [open, setOpen] = useState(false);

  const { timeMinutes, setTimeMinutes, setTimeToNow } = useSolarTime();
  const { isFetching } = useRoutes();

  const formattedTime = formatTime(timeMinutes);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Toggle time-of-day controls"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2.5 text-card-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card"
      >
        <Sun className="h-4 w-4 text-amber-600" />

        <span className="text-[10px] font-bold uppercase tracking-wide">
          IST
        </span>

        <span className="text-xs font-bold tabular-nums">{formattedTime}</span>

        {isFetching && (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
        )}

        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <section
          aria-label="Solar time controls"
          className="absolute right-0 top-12 w-[min(88vw,340px)] rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-bold">Sun position</p>
              </div>

              <p className="mt-1 text-[10px] text-muted-foreground">
                Change the time to recalculate campus shadows.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close time controls"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">
                {formattedTime}
              </p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Indian Standard Time
              </p>
            </div>

            <button
              type="button"
              onClick={setTimeToNow}
              className="rounded-full bg-secondary px-3 py-2 text-[10px] font-bold text-secondary-foreground transition-colors hover:bg-primary/10"
            >
              USE CURRENT TIME
            </button>
          </div>

          <div className="mb-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Quick preview
            </p>

            <div className="grid grid-cols-3 gap-2">
              {TIME_PRESETS.map(({ label, time, icon: Icon }) => {
                const selected = timeMinutes === time;

                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTimeMinutes(time)}
                    className={[
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">{label}</span>
                    <span className="text-[9px] tabular-nums opacity-75">
                      {formatTime(time)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Custom time
              </p>

              <span className="text-xs font-bold tabular-nums">
                {formattedTime}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={1439}
              step={5}
              value={timeMinutes}
              onChange={(event) =>
                setTimeMinutes(Number(event.currentTarget.value))
              }
              aria-label="Preview time of day"
              aria-valuetext={`${formattedTime} IST`}
              className="h-1.5 w-full cursor-pointer accent-primary"
            />

            <div className="mt-2 flex justify-between text-[9px] tabular-nums text-muted-foreground">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
            {isFetching ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary" />
                <p className="text-[10px] font-medium text-muted-foreground">
                  Recalculating route for {formattedTime}…
                </p>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <p className="text-[10px] font-medium text-muted-foreground">
                  Shadows and route calculations use {formattedTime} IST.
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
