import type { LonLat } from "@/types/routes";

export interface DemoTree {
  id: string;
  position: LonLat;
  shadeCenter: LonLat;
  canopyRadiusM: number;
  shadeRadiusM: number;
  heightM: number;
  rotationDeg: number;
  lowerColor: string;
  upperColor: string;
  crownColor: string;
}

interface RoadCluster {
  at: number;
  count: number;
  side: -1 | 1;
  spreadM: number;
  offsetM: number;
}

interface RoadCorridor {
  points: LonLat[];
  clusters: RoadCluster[];
}

const ROAD_CORRIDORS: RoadCorridor[] = [
  // Northern east-west walking track.
  {
    points: [
      [85.8936556, 20.4636493],
      [85.8966156, 20.4637151],
    ],
    clusters: [
      { at: 0.13, count: 4, side: -1, spreadM: 12, offsetM: 5.2 },
      { at: 0.39, count: 3, side: 1, spreadM: 10, offsetM: 6.2 },
      { at: 0.68, count: 4, side: -1, spreadM: 13, offsetM: 5.5 },
      { at: 0.89, count: 3, side: -1, spreadM: 9, offsetM: 5.8 },
    ],
  },

  // Main central east-west path.
  {
    points: [
      [85.8937362, 20.4630829],
      [85.8943753, 20.4631131],
      [85.8956468, 20.4631181],
      [85.8966018, 20.4631348],
    ],
    clusters: [
      { at: 0.12, count: 4, side: -1, spreadM: 12, offsetM: 5.0 },
      { at: 0.39, count: 4, side: -1, spreadM: 13, offsetM: 5.8 },
      { at: 0.66, count: 4, side: 1, spreadM: 12, offsetM: 5.4 },
      { at: 0.89, count: 3, side: -1, spreadM: 10, offsetM: 5.2 },
    ],
  },

  // Western connecting path.
  {
    points: [
      [85.8936556, 20.4636493],
      [85.8936572, 20.4635977],
      [85.8937068, 20.4632604],
      [85.8937362, 20.4630829],
      [85.893838, 20.4624689],
      [85.8939756, 20.4615574],
    ],
    clusters: [
      { at: 0.22, count: 3, side: 1, spreadM: 10, offsetM: 5.5 },
      { at: 0.46, count: 3, side: -1, spreadM: 11, offsetM: 5.8 },
    ],
  },

  // Eastern north-south walking track.
  {
    points: [
      [85.8966156, 20.4637151],
      [85.8966018, 20.4631348],
      [85.8966323, 20.4616829],
    ],
    clusters: [
      { at: 0.27, count: 3, side: 1, spreadM: 10, offsetM: 5.5 },
      { at: 0.69, count: 3, side: -1, spreadM: 10, offsetM: 5.8 },
    ],
  },

  // Western outer connector.
  {
    points: [
      [85.8928195, 20.4636332],
      [85.8930718, 20.4630538],
      [85.8925246, 20.4628729],
    ],
    clusters: [{ at: 0.43, count: 3, side: 1, spreadM: 11, offsetM: 5.8 }],
  },

  // Eastern service-road connector.
  {
    points: [
      [85.8972146, 20.4616844],
      [85.8972472, 20.462252],
      [85.8971862, 20.4626595],
      [85.8977391, 20.4628004],
    ],
    clusters: [{ at: 0.52, count: 3, side: -1, spreadM: 12, offsetM: 5.5 }],
  },
];

const PALETTES = [
  {
    lowerColor: "#66865D",
    upperColor: "#83A676",
    crownColor: "#A5BB7A",
  },
  {
    lowerColor: "#628662",
    upperColor: "#88A979",
    crownColor: "#B0C789",
  },
  {
    lowerColor: "#5D8059",
    upperColor: "#78996C",
    crownColor: "#A5BB7A",
  },
  {
    lowerColor: "#718B58",
    upperColor: "#91A96F",
    crownColor: "#B6C985",
  },
  {
    lowerColor: "#587A5A",
    upperColor: "#7F9D70",
    crownColor: "#A9BE82",
  },
];

function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(random: () => number): number {
  const u1 = Math.max(Number.EPSILON, random());
  const u2 = random();

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distanceMeters(a: LonLat, b: LonLat): number {
  const latitude = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const east = (a[0] - b[0]) * 111320 * Math.cos(latitude);
  const north = (a[1] - b[1]) * 110574;

  return Math.hypot(east, north);
}

function offsetCoordinate(
  origin: LonLat,
  eastM: number,
  northM: number,
): LonLat {
  const latitudeFactor = Math.cos((origin[1] * Math.PI) / 180);

  return [
    origin[0] + eastM / (111320 * latitudeFactor),
    origin[1] + northM / 110574,
  ];
}

function polylineLength(points: LonLat[]): number {
  let length = 0;

  for (let i = 0; i < points.length - 1; i++) {
    length += distanceMeters(points[i]!, points[i + 1]!);
  }

  return length;
}

function pointAlongRoad(
  points: LonLat[],
  requestedDistance: number,
): {
  point: LonLat;
  normalEast: number;
  normalNorth: number;
} {
  let traversed = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;

    const latitude = ((a[1] + b[1]) / 2) * (Math.PI / 180);
    const east = (b[0] - a[0]) * 111320 * Math.cos(latitude);
    const north = (b[1] - a[1]) * 110574;
    const length = Math.hypot(east, north);

    if (length === 0) continue;

    if (requestedDistance <= traversed + length || i === points.length - 2) {
      const t = clamp((requestedDistance - traversed) / length, 0, 1);

      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        normalEast: -north / length,
        normalNorth: east / length,
      };
    }

    traversed += length;
  }

  const last = points[points.length - 1]!;

  return {
    point: last,
    normalEast: 1,
    normalNorth: 0,
  };
}

function createDemoTrees(): DemoTree[] {
  const random = createRandom(0xc001cafe);
  const trees: DemoTree[] = [];

  for (const corridor of ROAD_CORRIDORS) {
    const length = polylineLength(corridor.points);

    for (const cluster of corridor.clusters) {
      for (let i = 0; i < cluster.count; i++) {
        let position: LonLat | null = null;

        // Retry when a candidate is too close to an existing tree.
        for (let attempt = 0; attempt < 35; attempt++) {
          const alongRoad = clamp(
            length * cluster.at + randomNormal(random) * cluster.spreadM,
            0,
            length,
          );

          const roadPoint = pointAlongRoad(corridor.points, alongRoad);

          const offset = clamp(
            cluster.offsetM + randomNormal(random) * 1.5,
            3.5,
            9,
          );

          const longitudinalJitter = randomNormal(random) * 2;

          const candidate = offsetCoordinate(
            roadPoint.point,
            roadPoint.normalEast * cluster.side * offset + longitudinalJitter,
            roadPoint.normalNorth * cluster.side * offset,
          );

          if (
            trees.every(
              (tree) => distanceMeters(tree.position, candidate) >= 4.5,
            )
          ) {
            position = candidate;
            break;
          }
        }

        if (!position) continue;

        const palette = PALETTES[Math.floor(random() * PALETTES.length)]!;

        trees.push({
          id: `tree-${String(trees.length + 1).padStart(2, "0")}`,
          position,
          shadeCenter: position,
          canopyRadiusM: 2.4 + random() * 0.9,
          shadeRadiusM: 5.2 + random() * 1.9,
          heightM: 6.2 + random() * 4.8,
          rotationDeg: random() * 360,
          ...palette,
        });
      }
    }
  }

  return trees;
}

export const DEMO_TREES: DemoTree[] = createDemoTrees();
