/**
 * Data-driven building visual classification.
 * Geography (footprint, height, id, OSM tags) is authoritative.
 * Archetype only selects reusable appearance — never invents entities.
 */

export type BuildingArchetype =
  | "RESIDENTIAL_LOW"
  | "RESIDENTIAL_MID"
  | "RESIDENTIAL_HIGH"
  | "COMMERCIAL_LOW"
  | "COMMERCIAL_HIGH"
  | "OFFICE_TOWER"
  | "INDUSTRIAL"
  | "WAREHOUSE"
  | "INSTITUTIONAL"
  | "HOSPITAL"
  | "SCHOOL"
  | "UNIVERSITY"
  | "POLICE"
  | "FIRE_STATION"
  | "HOTEL"
  | "MIXED_USE"
  | "LANDMARK"
  | "RELIGIOUS"
  | "TRANSPORT"
  | "GENERIC";

export type VisualMaterialId =
  | "CONCRETE"
  | "GLASS"
  | "BRICK"
  | "STONE"
  | "METAL"
  | "PAINTED"
  | "INDUSTRIAL"
  | "MODERN_GLASS"
  | "ROOFTOP";

export type HeightSource = "osm-height" | "osm-levels" | "estimated";

export interface BuildingVisual {
  archetype: BuildingArchetype;
  variant: number;
  materialId: VisualMaterialId;
  roofMaterialId: VisualMaterialId;
  floors: number;
  semantic: boolean;
  confidence: "high" | "medium" | "low";
  confidenceNote: string;
}

const VARIANT_COUNT = 4;

export function hashEntityId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function visualVariant(id: string): number {
  return hashEntityId(id) % VARIANT_COUNT;
}

function tag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Classify from OSM tags already present on the entity.
 * Unknown / building=yes uses height + name only — never relabels as hospital etc.
 */
export function classifyBuildingVisual(input: {
  id: string;
  name?: string;
  building?: string;
  amenity?: string;
  tourism?: string;
  office?: string;
  heightM: number;
  levels?: number | null;
  heightSource: HeightSource;
}): BuildingVisual {
  const building = tag(input.building);
  const amenity = tag(input.amenity);
  const tourism = tag(input.tourism);
  const office = tag(input.office);
  const name = String(input.name ?? "");
  const genericName = /^Building\s+\d+$/i.test(name) || name.length === 0;
  const floorsFromHeight = Math.max(1, Math.round(input.heightM / 3.2));
  const floors =
    Number.isFinite(input.levels) && (input.levels as number) > 0
      ? Math.max(1, Math.round(input.levels as number))
      : floorsFromHeight;
  const variant = visualVariant(input.id);

  const semanticFrom =
    amenity ||
    (building && building !== "yes" && building !== "roof" ? building : "") ||
    tourism ||
    office;

  const high = (archetype: BuildingArchetype, materialId: VisualMaterialId, note: string): BuildingVisual => ({
    archetype,
    variant,
    materialId,
    roofMaterialId: "ROOFTOP",
    floors,
    semantic: true,
    confidence: "high",
    confidenceNote: note,
  });

  if (amenity === "hospital" || building === "hospital") {
    return high("HOSPITAL", "PAINTED", "OSM amenity/building=hospital");
  }
  if (amenity === "fire_station" || building === "fire_station") {
    return high("FIRE_STATION", "PAINTED", "OSM fire_station");
  }
  if (amenity === "police" || building === "police") {
    return high("POLICE", "STONE", "OSM police");
  }
  if (amenity === "university" || building === "university") {
    return high("UNIVERSITY", "STONE", "OSM university");
  }
  if (amenity === "college" || amenity === "school" || building === "school" || building === "college") {
    return high("SCHOOL", "BRICK", "OSM school/college");
  }
  if (amenity === "hotel" || building === "hotel" || tourism === "hotel") {
    return high("HOTEL", "PAINTED", "OSM hotel");
  }
  if (
    building === "train_station" ||
    building === "transportation" ||
    amenity === "ferry_terminal" ||
    building === "hangar"
  ) {
    return high("TRANSPORT", "METAL", "OSM transport building");
  }
  if (
    building === "cathedral" ||
    building === "church" ||
    building === "chapel" ||
    building === "mosque" ||
    building === "synagogue" ||
    building === "temple"
  ) {
    return high("RELIGIOUS", "STONE", `OSM building=${building}`);
  }
  if (building === "stadium" || building === "civic" || building === "public") {
    return high("LANDMARK", "STONE", `OSM building=${building}`);
  }
  if (building === "industrial") {
    return high("INDUSTRIAL", "INDUSTRIAL", "OSM building=industrial");
  }
  if (building === "warehouse" || building === "shed") {
    return high("WAREHOUSE", "METAL", `OSM building=${building}`);
  }
  if (building === "office" || office) {
    return high(floors >= 10 ? "OFFICE_TOWER" : "COMMERCIAL_HIGH", "MODERN_GLASS", "OSM office");
  }
  if (building === "commercial" || building === "retail" || building === "kiosk") {
    return high(floors >= 8 ? "COMMERCIAL_HIGH" : "COMMERCIAL_LOW", "CONCRETE", `OSM building=${building}`);
  }
  if (building === "apartments") {
    return high(
      floors >= 12 ? "RESIDENTIAL_HIGH" : floors >= 5 ? "RESIDENTIAL_MID" : "RESIDENTIAL_LOW",
      "CONCRETE",
      "OSM building=apartments",
    );
  }
  if (building === "house" || building === "detached" || building === "terrace" || building === "residential") {
    return high("RESIDENTIAL_LOW", "PAINTED", `OSM building=${building}`);
  }
  if (building === "hotel") {
    return high("HOTEL", "PAINTED", "OSM building=hotel");
  }

  // building=yes / unknown: visual massing only — do not invent a hospital/school.
  let archetype: BuildingArchetype = "GENERIC";
  let materialId: VisualMaterialId = "CONCRETE";
  if (floors >= 16) {
    archetype = "OFFICE_TOWER";
    materialId = "MODERN_GLASS";
  } else if (floors >= 9) {
    archetype = "RESIDENTIAL_HIGH";
    materialId = "CONCRETE";
  } else if (floors >= 5) {
    archetype = "RESIDENTIAL_MID";
    materialId = "STONE";
  } else if (!genericName) {
    archetype = "MIXED_USE";
    materialId = "PAINTED";
  } else {
    archetype = "RESIDENTIAL_LOW";
    materialId = variant === 0 ? "STONE" : variant === 1 ? "PAINTED" : variant === 2 ? "BRICK" : "CONCRETE";
  }

  const inferred = !semanticFrom || building === "yes" || building === "roof";
  return {
    archetype,
    variant,
    materialId,
    roofMaterialId: "ROOFTOP",
    floors,
    semantic: false,
    confidence: inferred ? "low" : "medium",
    confidenceNote: inferred
      ? `Visual massing from height (${input.heightSource}); OSM building=${building || "yes"} — not a semantic POI`
      : `OSM building=${building}`,
  };
}
