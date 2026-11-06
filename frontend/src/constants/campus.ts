import type { CampusPreset } from '../types/route';

// Ravenshaw University Campus Center (Cuttack, Odisha)
export const RAVENSHAW_CENTER: [number, number] = [85.8945, 20.4632];
export const DEFAULT_ZOOM = 16.0;

// Campus Pilot Bounding Box [min_lon, min_lat, max_lon, max_lat]
export const CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [85.8890, 20.4585], // Southwest
  [85.9005, 20.4685]  // Northeast
];

// Curated campus landmarks & route presets for instant demo
export const CAMPUS_PRESETS: CampusPreset[] = [
  {
    id: 'preset-1',
    name: 'Main Gate ➔ Central Library',
    start: [85.89143, 20.45988],
    end: [85.89682, 20.46546],
    startName: 'College Square / Main Gate',
    endName: 'Kanika Library Quad',
  },
  {
    id: 'preset-2',
    name: 'East Hostels ➔ Walking Track',
    start: [85.89834, 20.46094],
    end: [85.89552, 20.46018],
    startName: 'East Campus Hostels',
    endName: 'Ravenshaw Walking Track',
  },
  {
    id: 'preset-3',
    name: 'North Complex ➔ Sports Ground',
    start: [85.89442, 20.46681],
    end: [85.89552, 20.46018],
    startName: 'North Science Block',
    endName: 'Sports Ground',
  },
];
