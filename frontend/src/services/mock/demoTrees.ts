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

export const DEMO_TREES: DemoTree[] = [
  {
    id: "tree-01",
    position: [85.89398, 20.463145],
    shadeCenter: [85.89398, 20.463094],
    canopyRadiusM: 2.8,
    shadeRadiusM: 5.0,
    heightM: 8.0,
    rotationDeg: 8,
    lowerColor: "#66865D",
    upperColor: "#83A676",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-02",
    position: [85.89425, 20.463054],
    shadeCenter: [85.89425, 20.463108],
    canopyRadiusM: 3.0,
    shadeRadiusM: 5.2,
    heightM: 7.5,
    rotationDeg: 29,
    lowerColor: "#628662",
    upperColor: "#88A979",
    crownColor: "#B0C789",
  },
  {
    id: "tree-03",
    position: [85.89454, 20.463165],
    shadeCenter: [85.89454, 20.463114],
    canopyRadiusM: 2.7,
    shadeRadiusM: 4.8,
    heightM: 8.6,
    rotationDeg: 14,
    lowerColor: "#5D8059",
    upperColor: "#78996C",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-04",
    position: [85.89483, 20.463061],
    shadeCenter: [85.89483, 20.463114],
    canopyRadiusM: 3.1,
    shadeRadiusM: 5.2,
    heightM: 8.2,
    rotationDeg: 41,
    lowerColor: "#66865D",
    upperColor: "#83A676",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-05",
    position: [85.89512, 20.463166],
    shadeCenter: [85.89512, 20.463115],
    canopyRadiusM: 2.9,
    shadeRadiusM: 5.0,
    heightM: 7.8,
    rotationDeg: 19,
    lowerColor: "#628662",
    upperColor: "#88A979",
    crownColor: "#B0C789",
  },
  {
    id: "tree-06",
    position: [85.89541, 20.463065],
    shadeCenter: [85.89541, 20.463116],
    canopyRadiusM: 2.8,
    shadeRadiusM: 5.0,
    heightM: 8.8,
    rotationDeg: 53,
    lowerColor: "#5D8059",
    upperColor: "#78996C",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-07",
    position: [85.8957, 20.46317],
    shadeCenter: [85.8957, 20.463119],
    canopyRadiusM: 3.2,
    shadeRadiusM: 5.3,
    heightM: 8.1,
    rotationDeg: 12,
    lowerColor: "#66865D",
    upperColor: "#83A676",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-08",
    position: [85.89599, 20.463071],
    shadeCenter: [85.89599, 20.463124],
    canopyRadiusM: 2.7,
    shadeRadiusM: 4.8,
    heightM: 7.6,
    rotationDeg: 35,
    lowerColor: "#628662",
    upperColor: "#88A979",
    crownColor: "#B0C789",
  },
  {
    id: "tree-09",
    position: [85.89628, 20.46318],
    shadeCenter: [85.89628, 20.463129],
    canopyRadiusM: 3.0,
    shadeRadiusM: 5.1,
    heightM: 8.5,
    rotationDeg: 24,
    lowerColor: "#5D8059",
    upperColor: "#78996C",
    crownColor: "#A5BB7A",
  },
  {
    id: "tree-10",
    position: [85.89648, 20.463078],
    shadeCenter: [85.89648, 20.463132],
    canopyRadiusM: 2.8,
    shadeRadiusM: 5.0,
    heightM: 8.2,
    rotationDeg: 47,
    lowerColor: "#66865D",
    upperColor: "#83A676",
    crownColor: "#A5BB7A",
  },
];
