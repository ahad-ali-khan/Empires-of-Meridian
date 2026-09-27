export type BuildingFootprint={hx:number;hz:number};
// Terrain reservation is a gameplay contract: visual models may change by age,
// but their legal ground area never does.
export const buildingFootprints:Record<string,BuildingFootprint>={
 hall:{hx:6.1,hz:4.6},house:{hx:2.9,hz:1.95},market:{hx:3,hz:3.5},tower:{hx:3,hz:3},
 lumberPost:{hx:2.8,hz:2},miningPost:{hx:2.9,hz:2.2},silo:{hx:2.8,hz:2.3},stable:{hx:3.9,hz:4.9},barracks:{hx:3.9,hz:4.9},archery:{hx:3.9,hz:4.9},workshop:{hx:3.9,hz:4.9},factory:{hx:4.8,hz:5.2},
 dock:{hx:4.2,hz:4.2},tradePost:{hx:3.2,hz:3.2},mercenaryHall:{hx:3.8,hz:4.1},embassy:{hx:3.8,hz:3.6},arsenal:{hx:3.8,hz:3.6},academy:{hx:3.9,hz:3.8},temple:{hx:3.7,hz:3.6},
 wall:{hx:3.2,hz:1.3},gate:{hx:4.2,hz:2.2},fort:{hx:6.8,hz:6.8},landmark:{hx:3.6,hz:3.6},farm:{hx:4.4,hz:6.2},estate:{hx:4.5,hz:5.7},fishery:{hx:2.2,hz:3.2}
};
export function buildingFootprint(kind:string):BuildingFootprint{return buildingFootprints[kind]||{hx:2.5,hz:2.5};}

