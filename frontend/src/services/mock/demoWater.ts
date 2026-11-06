import type { LonLat } from "@/types/routes";

export interface DemoWaterPoint {
  id: string;
  name: string;
  position: LonLat;
}

export const DEMO_WATER_POINTS: DemoWaterPoint[] = [
  {
    id: "water-01",
    name: "Water point 01",
    position: [85.8936556, 20.4636493],
  },
  {
    id: "water-02",
    name: "Water point 02",
    position: [85.8943753, 20.4631131],
  },
  {
    id: "water-03",
    name: "Water point 03",
    position: [85.8956468, 20.4631181],
  },
  {
    id: "water-04",
    name: "Water point 04",
    position: [85.8966156, 20.4637151],
  },
  {
    id: "water-05",
    name: "Water point 05",
    position: [85.8966323, 20.4616829],
  },
];
