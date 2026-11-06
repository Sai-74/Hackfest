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

const HEAT_COLOR_STOPS = [
  { score: 0, color: "#628662" },
  { score: 35, color: "#628662" },
  { score: 60, color: "#A5BB7A" },
  { score: 80, color: "#D9A441" },
  { score: 100, color: "#C0563F" },
];

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");

  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function interpolateColor(a: string, b: string, t: number): string {
  const start = hexToRgb(a);
  const end = hexToRgb(b);

  const channels = start.map((value, i) =>
    Math.round(value + (end[i] - value) * t),
  );

  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function heatColorFor(score: number): string {
  const value = Math.max(0, Math.min(100, score));

  for (let i = 1; i < HEAT_COLOR_STOPS.length; i++) {
    const previous = HEAT_COLOR_STOPS[i - 1];
    const current = HEAT_COLOR_STOPS[i];

    if (value <= current.score) {
      const t = (value - previous.score) / (current.score - previous.score);

      return interpolateColor(previous.color, current.color, t);
    }
  }

  return HEAT_COLOR_STOPS[HEAT_COLOR_STOPS.length - 1].color;
}
