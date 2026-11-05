export interface HeatBand {
  id: string;
  label: string;
  max: number;
  color: string;
}

export const HEAT_BANDS: HeatBand[] = [
  { id: "comfortable", label: "Comfortable", max: 35, color: "#628662" },
  { id: "moderate", label: "Moderate", max: 60, color: "#A5BB7A" },
  { id: "high", label: "High", max: 80, color: "#D9A441" },
  { id: "extreme", label: "Extreme", max: Infinity, color: "#C0563F" },
];

export function heatBandFor(score: number): HeatBand {
  return (
    HEAT_BANDS.find((b) => score < b.max) ?? HEAT_BANDS[HEAT_BANDS.length - 1]
  );
}

export function heatColorFor(score: number): string {
  return heatBandFor(score).color;
}
