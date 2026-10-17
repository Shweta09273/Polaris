import type { CanonicalEntity } from "../normalize/normalize.js";
import * as turf from "@turf/turf";
import type { BoundingBox } from "@polaris/domain";
import { writeJson } from "@polaris/connector-sdk";
import { join } from "node:path";

export interface CityDNA {
  readonly cityName: string;
  readonly aoiId: string;
  readonly areaKm2: number;
  readonly populationDensity: number | null;
  readonly roadDensityKmPerKm2: number | null;
  readonly hospitalDensityPer100k: number | null;
  readonly schoolCount: number;
  readonly greenCoverRatio: number | null;
  readonly waterCoverageRatio: number | null;
  readonly infrastructureScore: number;
  readonly floodRisk: number | null;
  readonly heatRisk: number | null;
  readonly mobilityScore: number;
  readonly connectivityScore: number;
  readonly utilityCoverage: number | null;
  readonly urbanComplexityIndex: number;
  readonly notes: string[];
}

function aoiAreaKm2(entities: CanonicalEntity[], bbox: BoundingBox): number {
  const twin = entities.find((e) => e.entityKind === "TwinScope" && e.geometry);
  if (twin?.geometry) {
    try {
      return turf.area({ type: "Feature", properties: {}, geometry: twin.geometry }) / 1e6;
    } catch {
      /* fallthrough */
    }
  }
  const poly = turf.bboxPolygon([bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat]);
  return turf.area(poly) / 1e6;
}

function roadLengthKm(entities: CanonicalEntity[]): number {
  let m = 0;
  for (const e of entities) {
    if (e.entityKind !== "RoadSegment" || !e.geometry) continue;
    try {
      if (e.geometry.type === "LineString" || e.geometry.type === "MultiLineString") {
        m += turf.length({ type: "Feature", properties: {}, geometry: e.geometry }, { units: "kilometers" });
      }
    } catch {
      /* skip */
    }
  }
  return m;
}

function polygonAreaKm2(entities: CanonicalEntity[], kind: CanonicalEntity["entityKind"]): number {
  let a = 0;
  for (const e of entities) {
    if (e.entityKind !== kind || !e.geometry) continue;
    try {
      if (e.geometry.type === "Polygon" || e.geometry.type === "MultiPolygon") {
        a += turf.area({ type: "Feature", properties: {}, geometry: e.geometry }) / 1e6;
      }
    } catch {
      /* skip */
    }
  }
  return a;
}

export function computeCityDNA(input: {
  cityName: string;
  aoiId: string;
  bbox: BoundingBox;
  entities: CanonicalEntity[];
  hasWeather: boolean;
  hasFloodDischarge: boolean;
  hasPopulationRaster: boolean;
  hasUtilities: boolean;
}): CityDNA {
  const notes: string[] = [];
  const areaKm2 = Math.max(aoiAreaKm2(input.entities, input.bbox), 0.01);
  const roadsKm = roadLengthKm(input.entities);
  const roadDensity = roadsKm / areaKm2;
  const hospitals = input.entities.filter((e) => e.entityKind === "Hospital").length;
  const schools = input.entities.filter((e) => e.entityKind === "School").length;
  const waterArea = polygonAreaKm2(input.entities, "Waterbody");
  const greenArea = polygonAreaKm2(input.entities, "LandUseZone"); // incomplete proxy from landuse=grass/forest if present

  const waterCoverageRatio = Math.min(1, waterArea / areaKm2);
  const greenCoverRatio = greenArea > 0 ? Math.min(1, greenArea / areaKm2) : null;
  if (greenCoverRatio == null) {
    notes.push("Green cover not computed — requires land cover raster or landuse vegetation polygons.");
  }

  const populationDensity = input.hasPopulationRaster ? null : null;
  if (!input.hasPopulationRaster) {
    notes.push("Population density null — WorldPop raster not ingested (not fabricated).");
  }

  const hospitalDensityPer100k = null;
  notes.push("Hospital density per 100k requires population denominator — unavailable without population layer.");

  // Infrastructure score from available structural layers (0..100)
  const kinds = new Set(input.entities.map((e) => e.entityKind));
  const infraBits = [
    kinds.has("RoadSegment"),
    kinds.has("Building"),
    kinds.has("Hospital"),
    kinds.has("School"),
    kinds.has("Waterway") || kinds.has("Waterbody"),
    kinds.has("RailwaySegment") || kinds.has("TransitRoute"),
    kinds.has("Airport"),
    kinds.has("FireStation") || kinds.has("PoliceStation"),
  ];
  const infrastructureScore = Math.round((infraBits.filter(Boolean).length / infraBits.length) * 100);

  const floodRisk = input.hasFloodDischarge ? null : null;
  if (!input.hasFloodDischarge) {
    notes.push("Flood risk score deferred — discharge present does not equal floodplain risk without DEM + zones.");
  } else {
    notes.push("Flood discharge series present; quantitative flood risk requires DEM inundation (not run in M2).");
  }

  const heatRisk = input.hasWeather ? null : null;
  if (!input.hasWeather) notes.push("Heat risk requires temperature archive — missing weather connector success.");
  else notes.push("Heat risk index deferred to climate analytics (Milestone 4+); weather artifacts retained.");

  const mobilityScore = Math.round(
    Math.min(
      100,
      (kinds.has("RoadSegment") ? 40 : 0) +
        (kinds.has("TransitRoute") || kinds.has("RailwaySegment") ? 30 : 0) +
        (kinds.has("Airport") ? 15 : 0) +
        Math.min(15, roadDensity * 2),
    ),
  );

  const connectivityScore = Math.round(
    Math.min(100, (kinds.has("RoadSegment") ? 50 : 0) + Math.min(50, Math.log10(1 + roadsKm) * 20)),
  );

  const utilityCoverage = input.hasUtilities ? null : null;
  if (!input.hasUtilities) {
    notes.push("Utility coverage null — no global public utility network (partner port only).");
  }

  const urbanComplexityIndex = Math.round(
    Math.min(
      100,
      kinds.size * 4 +
        Math.min(30, Math.log10(1 + input.entities.length) * 10) +
        Math.min(20, roadDensity * 3),
    ),
  );

  return {
    cityName: input.cityName,
    aoiId: input.aoiId,
    areaKm2: Number(areaKm2.toFixed(3)),
    populationDensity,
    roadDensityKmPerKm2: Number(roadDensity.toFixed(3)),
    hospitalDensityPer100k,
    schoolCount: schools,
    greenCoverRatio,
    waterCoverageRatio: Number(waterCoverageRatio.toFixed(4)),
    infrastructureScore,
    floodRisk,
    heatRisk,
    mobilityScore,
    connectivityScore,
    utilityCoverage,
    urbanComplexityIndex,
    notes,
    // expose hospital count indirectly via notes if needed
  };
}

export function writeCityDNA(workDir: string, dna: CityDNA): string {
  const path = join(workDir, "city-dna.json");
  writeJson(path, { ...dna, hospitalCountHint: undefined });
  return path;
}
