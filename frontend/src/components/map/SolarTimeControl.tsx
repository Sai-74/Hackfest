import { useState } from "react";
import { ChevronDown, Sun, X } from "lucide-react";

import { useSolarTime } from "@/features/shade/solar-time-context";

export function SolarTimeControl() {
  const [open, setOpen] = useState(false);

  const { timeMinutes, setTimeMinutes, setTimeToNow } = useSolarTime();

  const formattedTime = `${String(Math.floor(timeMinutes / 60)).padStart(2, "0")}:${String(timeMinutes % 60).padStart(2, "0")}`;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-30">
      {/* Always-visible demo control */}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Toggle time-of-day controls"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-3.5 py-2.5 text-card-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card"
      >
        <Sun className="h-4 w-4 text-amber-600" />

        <span className="text-[10px] font-bold uppercase tracking-wide">
          Time
        </span>

        <span className="text-xs font-bold tabular-nums">{formattedTime}</span>

        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Hidden until the button is pressed */}
      {open && (
        <section
          aria-label="Demo time controls"
          className="absolute right-0 top-12 w-[min(88vw,320px)] rounded-2xl border border-border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold">Time of day</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Preview sunlight and tree shadows
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

          <div className="mb-3 flex items-center justify-between">
            <span className="text-2xl font-bold tabular-nums">
              {formattedTime}
            </span>

            <button
              type="button"
              onClick={setTimeToNow}
              className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-bold text-secondary-foreground transition-colors hover:bg-primary/10"
            >
              USE CURRENT TIME
            </button>
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
            aria-valuetext={formattedTime}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />

          <div className="mt-2 flex justify-between text-[9px] tabular-nums text-muted-foreground">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </section>
      )}
    </div>
  );
}
